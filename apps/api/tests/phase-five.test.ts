import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { type OrderRealtimeEvent, type UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { createOrderEventHub } from '../src/features/order-events';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'PaymentTest12!';
let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

async function fixture(role: UserRole = 'OWNER', priceKurus = 10_001) {
  const store = new MemoryStore();
  const user = store.seedUser({
    fullName: 'Kasa Personeli',
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
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Cookie yok.');
  const cookie = cookies[0].split(';')[0] ?? '';
  const area = await store.createArea({
    actorUserId: user.id,
    name: 'Salon',
    nameKey: 'salon',
    sortOrder: 0,
    isActive: true,
  });
  const table = await store.createTable({
    actorUserId: user.id,
    areaId: area.id,
    name: 'Masa 5',
    nameKey: 'masa 5',
    capacity: 4,
    sortOrder: 0,
    isActive: true,
  });
  const category = await store.createCategory({
    actorUserId: user.id,
    name: 'Ürünler',
    nameKey: 'ürünler',
    sortOrder: 0,
    isActive: true,
  });
  const product = await store.createProduct({
    actorUserId: user.id,
    categoryId: category.id,
    name: 'Kahvaltı',
    nameKey: 'kahvaltı',
    priceKurus,
    preparationArea: 'KITCHEN',
    sortOrder: 0,
    isActive: true,
  });
  const check = await store.openCheck({ actorUserId: user.id, tableId: table.id, guestCount: 3 });
  const withItem = await store.addOrderItem({
    actorUserId: user.id,
    checkId: check.id,
    productId: product.id,
    quantity: 1,
    note: null,
    optionValueIds: [],
  });
  return { store, app, cookie, user, table, check: withItem, events };
}

function pay(
  input: Awaited<ReturnType<typeof fixture>>,
  method: 'CASH' | 'CARD',
  amountKurus: number,
  cashReceivedKurus: number | null = null,
) {
  return request(input.app)
    .post(`/api/orders/checks/${input.check.id}/payments`)
    .set('Cookie', input.cookie)
    .send({ method, amountKurus, cashReceivedKurus });
}

describe('Phase 5 ödeme ve hesap kapatma', () => {
  it('nakit, kart ve karışık ödemeyi immutable satırlar olarak kaydeder', async () => {
    const input = await fixture();
    const cash = await pay(input, 'CASH', 4_000, 5_000);
    expect(cash.status).toBe(201);
    expect(cash.body.check).toMatchObject({ paidKurus: 4_000, remainingKurus: 6_001 });
    expect(cash.body.check.payments[0]).toMatchObject({ method: 'CASH', amountKurus: 4_000 });

    const card = await pay(input, 'CARD', 6_001);
    expect(card.status).toBe(201);
    expect(card.body.check).toMatchObject({ paidKurus: 10_001, remainingKurus: 0 });
    expect(card.body.check.payments.map((entry: { method: string }) => entry.method)).toEqual([
      'CASH',
      'CARD',
    ]);
    expect(input.store.audits.filter((entry) => entry.action === 'PAYMENT_RECEIVED')).toHaveLength(
      2,
    );
  });

  it('fazla ödemeyi, yetersiz nakdi ve eksik bakiye ile kapanışı reddeder', async () => {
    const input = await fixture();
    expect((await pay(input, 'CASH', 4_000, 3_999)).status).toBe(400);
    expect((await pay(input, 'CARD', 10_002)).status).toBe(400);
    await pay(input, 'CARD', 4_000);
    const close = await request(input.app)
      .post(`/api/orders/checks/${input.check.id}/close`)
      .set('Cookie', input.cookie);
    expect(close.status).toBe(409);
  });

  it('tutar, kalem ve kişi bölümlerini kuruş kaybetmeden hesaplar', async () => {
    const input = await fixture();
    const amount = await request(input.app)
      .post(`/api/orders/checks/${input.check.id}/payment-split`)
      .set('Cookie', input.cookie)
      .send({ mode: 'AMOUNT', amountKurus: 4_000 });
    expect(
      amount.body.split.shares.map((entry: { amountKurus: number }) => entry.amountKurus),
    ).toEqual([4_000, 6_001]);

    const item = await request(input.app)
      .post(`/api/orders/checks/${input.check.id}/payment-split`)
      .set('Cookie', input.cookie)
      .send({ mode: 'ITEMS', itemIds: [input.check.items[0]?.id] });
    expect(item.body.split.shares).toEqual([
      { label: 'Seçilen kalemler', amountKurus: 10_001, itemIds: [input.check.items[0]?.id] },
    ]);

    const guests = await request(input.app)
      .post(`/api/orders/checks/${input.check.id}/payment-split`)
      .set('Cookie', input.cookie)
      .send({ mode: 'GUESTS' });
    const shares = guests.body.split.shares.map(
      (entry: { amountKurus: number }) => entry.amountKurus,
    );
    expect(shares).toEqual([3_334, 3_334, 3_333]);
    expect(shares.reduce((sum: number, value: number) => sum + value, 0)).toBe(10_001);
    expect(
      input.store.audits.filter((entry) => entry.action === 'CHECK_SPLIT_PREVIEWED'),
    ).toHaveLength(3);
  });

  it('eşzamanlı fazla ödeme girişimlerinden yalnız birini kabul eder', async () => {
    const input = await fixture('OWNER', 8_000);
    const results = await Promise.all([pay(input, 'CARD', 8_000), pay(input, 'CARD', 8_000)]);
    expect(results.map((entry) => entry.status).sort()).toEqual([201, 400]);
    expect((await input.store.getCheck(input.check.id)).payments).toHaveLength(1);
  });

  it('kalem değişikliğiyle toplamın alınmış ödemenin altına düşmesini engeller', async () => {
    const input = await fixture('OWNER', 8_000);
    const itemId = input.check.items[0]?.id ?? '';
    await request(input.app)
      .patch(`/api/orders/items/${itemId}`)
      .set('Cookie', input.cookie)
      .send({ quantity: 2, note: null });
    await pay(input, 'CARD', 12_000);
    const decrease = await request(input.app)
      .patch(`/api/orders/items/${itemId}`)
      .set('Cookie', input.cookie)
      .send({ quantity: 1, note: null });
    const cancel = await request(input.app)
      .post(`/api/orders/items/${itemId}/cancel`)
      .set('Cookie', input.cookie)
      .send({ reason: 'Müşteri vazgeçti' });
    expect(decrease.status).toBe(409);
    expect(cancel.status).toBe(409);
  });

  it('ödenen adisyonu kapatır, masayı boşaltır ve sonraki mutationları engeller', async () => {
    const input = await fixture('OWNER', 8_000);
    await pay(input, 'CARD', 8_000);
    const closed = await request(input.app)
      .post(`/api/orders/checks/${input.check.id}/close`)
      .set('Cookie', input.cookie);
    expect(closed.status).toBe(200);
    expect(closed.body.check).toMatchObject({ status: 'PAID', remainingKurus: 0 });
    expect(closed.body.check.closedAt).toEqual(expect.any(String));

    const floor = await request(input.app)
      .get('/api/orders/floor-plan')
      .set('Cookie', input.cookie);
    expect(floor.body.areas[0].tables[0].openCheck).toBeNull();
    expect((await pay(input, 'CARD', 1)).status).toBe(409);
    expect(
      (
        await request(input.app)
          .patch(`/api/orders/items/${input.check.items[0]?.id}`)
          .set('Cookie', input.cookie)
          .send({ quantity: 2, note: null })
      ).status,
    ).toBe(409);
    expect(input.store.audits.map((entry) => entry.action)).toContain('CHECK_CLOSED');
  });

  it('yetkisiz erişimi reddeder ve ödeme/kapanış eventlerini yayınlar', async () => {
    const kitchen = await fixture('KITCHEN', 8_000);
    expect((await pay(kitchen, 'CARD', 8_000)).status).toBe(403);
    expect(
      (await request(kitchen.app).post(`/api/orders/checks/${kitchen.check.id}/payments`)).status,
    ).toBe(401);

    const owner = await fixture('OWNER', 8_000);
    const received: OrderRealtimeEvent[] = [];
    owner.events.subscribe((event) => received.push(event));
    await pay(owner, 'CARD', 8_000);
    await request(owner.app)
      .post(`/api/orders/checks/${owner.check.id}/close`)
      .set('Cookie', owner.cookie);
    expect(received.slice(-2)).toEqual([
      { type: 'PAYMENT_ADDED', checkId: owner.check.id },
      { type: 'CHECK_CLOSED', checkId: owner.check.id },
    ]);
  });
});
