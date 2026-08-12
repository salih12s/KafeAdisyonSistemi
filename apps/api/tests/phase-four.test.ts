import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as createSocketClient, type Socket } from 'socket.io-client';
import { ORDER_REALTIME_EVENT, type OrderRealtimeEvent, type UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { createOrderEventHub, type OrderEventHub } from '../src/features/order-events';
import { createRealtimeServer, type RealtimeServer } from '../src/realtime';
import { createSilentLogger } from '../src/lib/logger';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'KitchenTest12!';
let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

interface Scenario {
  store: MemoryStore;
  app: ReturnType<typeof createTestApp>;
  cookie: string;
  userId: string;
  events: OrderEventHub;
}

async function scenario(role: UserRole = 'OWNER'): Promise<Scenario> {
  const store = new MemoryStore();
  const user = store.seedUser({
    fullName: 'Hazırlık Personeli',
    username: role.toLowerCase(),
    passwordHash,
    role,
  });
  const events = createOrderEventHub();
  const app = createTestApp({ databaseConnected: true, store, orderEvents: events });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: role.toLowerCase(), password: PASSWORD });
  const cookies: unknown = login.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Oturum çerezi alınamadı.');
  }
  return {
    store,
    app,
    cookie: cookies[0].split(';')[0] ?? '',
    userId: user.id,
    events,
  };
}

async function orderFixture(role: UserRole = 'OWNER') {
  const input = await scenario(role);
  const actorId = input.userId;
  const area = await input.store.createArea({
    actorUserId: actorId,
    name: 'Salon',
    nameKey: 'salon',
    sortOrder: 0,
    isActive: true,
  });
  const table = await input.store.createTable({
    actorUserId: actorId,
    areaId: area.id,
    name: 'Masa 4',
    nameKey: 'masa 4',
    capacity: 4,
    sortOrder: 0,
    isActive: true,
  });
  const category = await input.store.createCategory({
    actorUserId: actorId,
    name: 'İçecekler',
    nameKey: 'içecekler',
    sortOrder: 0,
    isActive: true,
  });
  const barProduct = await input.store.createProduct({
    actorUserId: actorId,
    categoryId: category.id,
    name: 'Latte',
    nameKey: 'latte',
    priceKurus: 8000,
    preparationArea: 'BAR',
    sortOrder: 0,
    isActive: true,
  });
  const kitchenProduct = await input.store.createProduct({
    actorUserId: actorId,
    categoryId: category.id,
    name: 'Tost',
    nameKey: 'tost',
    priceKurus: 12000,
    preparationArea: 'KITCHEN',
    sortOrder: 1,
    isActive: true,
  });
  const check = await input.store.openCheck({
    actorUserId: actorId,
    tableId: table.id,
    guestCount: 2,
  });
  return { ...input, checkId: check.id, categoryId: category.id, barProduct, kitchenProduct };
}

async function addItem(input: Awaited<ReturnType<typeof orderFixture>>, productId: string) {
  return request(input.app)
    .post(`/api/orders/checks/${input.checkId}/items`)
    .set('Cookie', input.cookie)
    .send({ productId, quantity: 1, optionValueIds: [] });
}

describe('Phase 4 hazırlık API ve durum akışı', () => {
  it('istasyonu sipariş anında snapshotlar ve KITCHEN/BAR filtrelerini ayırır', async () => {
    const input = await orderFixture();
    const added = await addItem(input, input.barProduct.id);
    const itemId = String(added.body.check.items[0].id);
    await input.store.updateProduct(input.barProduct.id, {
      actorUserId: input.userId,
      categoryId: input.categoryId,
      name: 'Latte',
      nameKey: 'latte',
      priceKurus: 8000,
      preparationArea: 'KITCHEN',
      sortOrder: 0,
      isActive: true,
    });
    await addItem(input, input.kitchenProduct.id);

    const bar = await request(input.app)
      .get('/api/orders/kitchen?preparationArea=BAR')
      .set('Cookie', input.cookie);
    const kitchen = await request(input.app)
      .get('/api/orders/kitchen?preparationArea=KITCHEN')
      .set('Cookie', input.cookie);
    expect(bar.body.orders).toHaveLength(1);
    expect(bar.body.orders[0]).toMatchObject({
      itemId,
      preparationArea: 'BAR',
      tableName: 'Masa 4',
    });
    expect(kitchen.body.orders).toHaveLength(1);
    expect(added.body.check.items[0]).toMatchObject({
      preparationAreaSnapshot: 'BAR',
      preparationStatus: 'SENT',
    });
  });

  it('yalnız SENT → PREPARING → READY → SERVED geçişlerini kabul eder ve audit yazar', async () => {
    const input = await orderFixture();
    const added = await addItem(input, input.barProduct.id);
    const itemId = String(added.body.check.items[0].id);
    const invalid = await request(input.app)
      .patch(`/api/orders/items/${itemId}/status`)
      .set('Cookie', input.cookie)
      .send({ status: 'READY' });
    expect(invalid.status).toBe(409);

    for (const status of ['PREPARING', 'READY', 'SERVED'] as const) {
      const response = await request(input.app)
        .patch(`/api/orders/items/${itemId}/status`)
        .set('Cookie', input.cookie)
        .send({ status });
      expect(response.status).toBe(200);
      expect(response.body.check.items[0].preparationStatus).toBe(status);
    }
    expect((await input.store.listKitchenOrders()).length).toBe(0);
    expect(input.store.audits.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['ORDER_ITEM_PREPARING', 'ORDER_ITEM_READY', 'ORDER_ITEM_SERVED']),
    );
  });

  it('iptal edilmiş kalemin durumunu değiştirmez', async () => {
    const input = await orderFixture();
    const added = await addItem(input, input.barProduct.id);
    const itemId = String(added.body.check.items[0].id);
    await request(input.app)
      .post(`/api/orders/items/${itemId}/cancel`)
      .set('Cookie', input.cookie)
      .send({ reason: 'Müşteri vazgeçti' });
    const response = await request(input.app)
      .patch(`/api/orders/items/${itemId}/status`)
      .set('Cookie', input.cookie)
      .send({ status: 'PREPARING' });
    expect(response.status).toBe(409);
  });

  it('oturumsuz mutfak API erişimini reddeder, KITCHEN rolüne durum yetkisi verir', async () => {
    const input = await orderFixture('KITCHEN');
    const added = await input.store.addOrderItem({
      actorUserId: input.userId,
      checkId: input.checkId,
      productId: input.barProduct.id,
      quantity: 1,
      note: null,
      optionValueIds: [],
    });
    const itemId = added.items[0]?.id ?? '';
    expect((await request(input.app).get('/api/orders/kitchen')).status).toBe(401);
    const response = await request(input.app)
      .patch(`/api/orders/items/${itemId}/status`)
      .set('Cookie', input.cookie)
      .send({ status: 'PREPARING' });
    expect(response.status).toBe(200);
  });

  it('ekleme, güncelleme, iptal ve status event payloadlarını küçük tutar', async () => {
    const input = await orderFixture();
    const received: OrderRealtimeEvent[] = [];
    input.events.subscribe((event) => received.push(event));
    const added = await addItem(input, input.barProduct.id);
    const itemId = String(added.body.check.items[0].id);
    await request(input.app)
      .patch(`/api/orders/items/${itemId}`)
      .set('Cookie', input.cookie)
      .send({ quantity: 2, note: 'Az sıcak' });
    await request(input.app)
      .patch(`/api/orders/items/${itemId}/status`)
      .set('Cookie', input.cookie)
      .send({ status: 'PREPARING' });
    await request(input.app)
      .post(`/api/orders/items/${itemId}/cancel`)
      .set('Cookie', input.cookie)
      .send({ reason: 'Yanlış masa' });
    expect(received.map((event) => event.type)).toEqual([
      'ITEM_ADDED',
      'ITEM_UPDATED',
      'ITEM_STATUS_CHANGED',
      'ITEM_CANCELLED',
    ]);
    expect(Object.keys(received[0] ?? {})).toEqual([
      'type',
      'checkId',
      'itemId',
      'preparationArea',
    ]);
  });
});

interface RunningRealtime {
  url: string;
  server: HttpServer;
  realtime: RealtimeServer;
}

async function runRealtime(input: Scenario): Promise<RunningRealtime> {
  const server = createServer(input.app);
  const realtime = createRealtimeServer(server, input.store, input.events, createSilentLogger());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${address.port}`, server, realtime };
}

function connect(url: string, cookie?: string): Socket {
  return createSocketClient(url, {
    transports: ['websocket'],
    reconnection: false,
    ...(cookie === undefined ? {} : { extraHeaders: { Cookie: cookie } }),
  });
}

async function closeRealtime(running: RunningRealtime, socket?: Socket): Promise<void> {
  socket?.disconnect();
  await running.realtime.close();
  if (running.server.listening) {
    await new Promise<void>((resolve) => running.server.close(() => resolve()));
  }
}

describe('Phase 4 Socket.IO authentication ve event hattı', () => {
  it('oturumsuz socket bağlantısını reddeder, cookie session ile bağlantıyı kabul eder', async () => {
    const input = await scenario();
    const running = await runRealtime(input);
    const unauthorized = connect(running.url);
    await expect(
      new Promise<string>((resolve) =>
        unauthorized.on('connect_error', (error) => resolve(error.message)),
      ),
    ).resolves.toBe('UNAUTHORIZED');
    unauthorized.disconnect();

    const authorized = connect(running.url, input.cookie);
    await expect(
      new Promise<void>((resolve) => authorized.on('connect', resolve)),
    ).resolves.toBeUndefined();
    await closeRealtime(running, authorized);
  });

  it('yeni sipariş eventini authenticated socket istemcisine yayınlar', async () => {
    const input = await orderFixture();
    const running = await runRealtime(input);
    const socket = connect(running.url, input.cookie);
    await new Promise<void>((resolve) => socket.on('connect', resolve));
    const eventPromise = new Promise<OrderRealtimeEvent>((resolve) => {
      socket.once(ORDER_REALTIME_EVENT, resolve);
    });
    await addItem(input, input.barProduct.id);
    await expect(eventPromise).resolves.toMatchObject({
      type: 'ITEM_ADDED',
      preparationArea: 'BAR',
    });
    await closeRealtime(running, socket);
  });
});
