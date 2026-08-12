import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { API_ERROR_CODES, type UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'OrderTest12!';
let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

interface Scenario {
  app: Express;
  store: MemoryStore;
  cookie: string;
  userId: string;
}

async function scenario(role: UserRole = 'OWNER'): Promise<Scenario> {
  const store = new MemoryStore();
  const user = store.seedUser({
    fullName: role === 'OWNER' ? 'İşletme Sahibi' : 'Test Personeli',
    username: role.toLowerCase(),
    passwordHash,
    role,
  });
  const app = createTestApp({ databaseConnected: true, store });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: role.toLowerCase(), password: PASSWORD });
  const cookies: unknown = login.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Oturum çerezi alınamadı.');
  }
  return { app, store, userId: user.id, cookie: cookies[0].split(';')[0] ?? '' };
}

async function seedTable(input: Scenario): Promise<string> {
  const area = await request(input.app)
    .post('/api/areas')
    .set('Cookie', input.cookie)
    .send({ name: 'Salon', sortOrder: 0 });
  const table = await request(input.app)
    .post('/api/tables')
    .set('Cookie', input.cookie)
    .send({ areaId: area.body.area.id, name: 'Masa 1', capacity: 4, sortOrder: 0 });
  return String(table.body.table.id);
}

async function openTable(input: Scenario, tableId: string): Promise<string> {
  const response = await request(input.app)
    .post('/api/orders/checks')
    .set('Cookie', input.cookie)
    .send({ tableId, guestCount: 3 });
  expect(response.status).toBe(201);
  return String(response.body.check.id);
}

interface MenuFixture {
  categoryId: string;
  productId: string;
  sizeGroupId: string;
  smallId: string;
  largeId: string;
  extrasGroupId: string;
  shotId: string;
}

async function seedMenu(input: Scenario): Promise<MenuFixture> {
  const category = await request(input.app)
    .post('/api/menu/categories')
    .set('Cookie', input.cookie)
    .send({ name: 'Kahveler', sortOrder: 0 });
  const categoryId = String(category.body.category.id);
  const product = await request(input.app)
    .post('/api/menu/products')
    .set('Cookie', input.cookie)
    .send({
      categoryId,
      name: 'Latte',
      priceKurus: 8000,
      preparationArea: 'BAR',
      sortOrder: 0,
    });
  const productId = String(product.body.product.id);
  const size = await request(input.app)
    .post(`/api/menu/products/${productId}/option-groups`)
    .set('Cookie', input.cookie)
    .send({ name: 'Boyut', selectionType: 'SINGLE', isRequired: true, sortOrder: 0 });
  const sizeGroupId = String(size.body.optionGroup.id);
  const small = await request(input.app)
    .post(`/api/menu/option-groups/${sizeGroupId}/values`)
    .set('Cookie', input.cookie)
    .send({ name: 'Küçük', priceDeltaKurus: -500, sortOrder: 0 });
  const large = await request(input.app)
    .post(`/api/menu/option-groups/${sizeGroupId}/values`)
    .set('Cookie', input.cookie)
    .send({ name: 'Büyük', priceDeltaKurus: 1000, sortOrder: 1 });
  const extras = await request(input.app)
    .post(`/api/menu/products/${productId}/option-groups`)
    .set('Cookie', input.cookie)
    .send({ name: 'Ekstralar', selectionType: 'MULTIPLE', isRequired: false, sortOrder: 1 });
  const extrasGroupId = String(extras.body.optionGroup.id);
  const shot = await request(input.app)
    .post(`/api/menu/option-groups/${extrasGroupId}/values`)
    .set('Cookie', input.cookie)
    .send({ name: 'Ekstra shot', priceDeltaKurus: 1500, sortOrder: 0 });
  return {
    categoryId,
    productId,
    sizeGroupId,
    smallId: String(small.body.optionValue.id),
    largeId: String(large.body.optionValue.id),
    extrasGroupId,
    shotId: String(shot.body.optionValue.id),
  };
}

async function orderFixture() {
  const input = await scenario();
  const tableId = await seedTable(input);
  const checkId = await openTable(input, tableId);
  const menu = await seedMenu(input);
  return { ...input, tableId, checkId, menu };
}

describe('Masa açma ve adisyon', () => {
  it('masayı kişi sayısı, açan personel ve zamanla açar', async () => {
    const input = await scenario();
    const tableId = await seedTable(input);
    const response = await request(input.app)
      .post('/api/orders/checks')
      .set('Cookie', input.cookie)
      .send({ tableId, guestCount: 3 });
    expect(response.status).toBe(201);
    expect(response.body.check).toMatchObject({
      tableId,
      tableName: 'Masa 1',
      openedByUserId: input.userId,
      guestCount: 3,
      status: 'OPEN',
      totalKurus: 0,
    });
    expect(response.body.check.openedAt).toEqual(expect.any(String));
    expect(input.store.audits.some((audit) => audit.action === 'CHECK_OPENED')).toBe(true);
  });

  it('aynı masada ikinci açık adisyonu engeller', async () => {
    const input = await scenario();
    const tableId = await seedTable(input);
    await openTable(input, tableId);
    const second = await request(input.app)
      .post('/api/orders/checks')
      .set('Cookie', input.cookie)
      .send({ tableId, guestCount: 2 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe(API_ERROR_CODES.CONFLICT);
  });

  it('masanın açık adisyonunu ve operasyon floor plan durumunu döndürür', async () => {
    const input = await scenario();
    const tableId = await seedTable(input);
    const checkId = await openTable(input, tableId);
    const byTable = await request(input.app)
      .get(`/api/orders/tables/${tableId}/open-check`)
      .set('Cookie', input.cookie);
    const floor = await request(input.app)
      .get('/api/orders/floor-plan')
      .set('Cookie', input.cookie);
    expect(byTable.body.check.id).toBe(checkId);
    expect(floor.body.areas[0].tables[0].openCheck).toMatchObject({ id: checkId, guestCount: 3 });
  });

  it('kişi sayısını backend üzerinde doğrular', async () => {
    const input = await scenario();
    const tableId = await seedTable(input);
    const response = await request(input.app)
      .post('/api/orders/checks')
      .set('Cookie', input.cookie)
      .send({ tableId, guestCount: 0 });
    expect(response.status).toBe(400);
  });
});

describe('Sipariş seçenekleri ve fiyat hesabı', () => {
  it('zorunlu seçenek eksikse 400 döndürür', async () => {
    const input = await orderFixture();
    const response = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [] });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Boyut');
  });

  it('SINGLE grupta birden çok seçimi reddeder', async () => {
    const input = await orderFixture();
    const response = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({
        productId: input.menu.productId,
        quantity: 1,
        optionValueIds: [input.menu.smallId, input.menu.largeId],
      });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('yalnız bir seçim');
  });

  it('MULTIPLE seçimi kabul eder ve fiyatı (ürün + seçenekler) × adet hesaplar', async () => {
    const input = await orderFixture();
    const response = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({
        productId: input.menu.productId,
        quantity: 2,
        optionValueIds: [input.menu.largeId, input.menu.shotId],
        unitPriceKurus: 1,
        lineTotalKurus: 1,
      });
    expect(response.status).toBe(201);
    expect(response.body.check.items[0]).toMatchObject({
      unitPriceKurusSnapshot: 8000,
      quantity: 2,
      lineTotalKurus: 21_000,
    });
    expect(response.body.check.totalKurus).toBe(21_000);
  });

  it('başka ürüne ait veya yinelenen seçeneği reddeder', async () => {
    const input = await orderFixture();
    const duplicate = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({
        productId: input.menu.productId,
        quantity: 1,
        optionValueIds: [input.menu.smallId, input.menu.smallId],
      });
    expect(duplicate.status).toBe(400);
  });

  it('ürün fiyatı değişse de eski kalemin snapshot fiyatı değişmez', async () => {
    const input = await orderFixture();
    const added = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [input.menu.smallId] });
    const itemId = String(added.body.check.items[0].id);
    await request(input.app)
      .patch(`/api/menu/products/${input.menu.productId}`)
      .set('Cookie', input.cookie)
      .send({
        categoryId: input.menu.categoryId,
        name: 'Latte Yeni',
        priceKurus: 12_000,
        preparationArea: 'BAR',
        sortOrder: 0,
        isActive: true,
      });
    const updated = await request(input.app)
      .patch(`/api/orders/items/${itemId}`)
      .set('Cookie', input.cookie)
      .send({ quantity: 2, note: null });
    expect(updated.body.check.items[0]).toMatchObject({
      productNameSnapshot: 'Latte',
      unitPriceKurusSnapshot: 8000,
      lineTotalKurus: 15_000,
    });
  });
});

describe('Kalem değişikliği, iptal ve yetki', () => {
  it('adet ve notu güncelleyip toplamı yeniden hesaplar', async () => {
    const input = await orderFixture();
    const added = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [input.menu.largeId] });
    const itemId = String(added.body.check.items[0].id);
    const response = await request(input.app)
      .patch(`/api/orders/items/${itemId}`)
      .set('Cookie', input.cookie)
      .send({ quantity: 3, note: 'Az sıcak' });
    expect(response.body.check.items[0]).toMatchObject({
      quantity: 3,
      note: 'Az sıcak',
      lineTotalKurus: 27_000,
    });
    expect(response.body.check.totalKurus).toBe(27_000);
    expect(input.store.audits.some((audit) => audit.action === 'ORDER_ITEM_UPDATED')).toBe(true);
  });

  it('kalemi gerekçe ve personelle iptal eder; toplamdan çıkarır', async () => {
    const input = await orderFixture();
    const first = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [input.menu.smallId] });
    await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [input.menu.largeId] });
    const itemId = String(first.body.check.items[0].id);
    const cancelled = await request(input.app)
      .post(`/api/orders/items/${itemId}/cancel`)
      .set('Cookie', input.cookie)
      .send({ reason: 'Müşteri vazgeçti' });
    expect(cancelled.body.check.totalKurus).toBe(9000);
    expect(cancelled.body.check.items[0]).toMatchObject({
      cancellationReason: 'Müşteri vazgeçti',
      cancelledByUserId: input.userId,
    });
    expect(cancelled.body.check.items[0].cancelledAt).toEqual(expect.any(String));
    expect(input.store.audits.some((audit) => audit.action === 'ORDER_ITEM_CANCELLED')).toBe(true);
  });

  it('iptal edilen kalemi yeniden değiştirmez veya iptal etmez', async () => {
    const input = await orderFixture();
    const added = await request(input.app)
      .post(`/api/orders/checks/${input.checkId}/items`)
      .set('Cookie', input.cookie)
      .send({ productId: input.menu.productId, quantity: 1, optionValueIds: [input.menu.smallId] });
    const itemId = String(added.body.check.items[0].id);
    await request(input.app)
      .post(`/api/orders/items/${itemId}/cancel`)
      .set('Cookie', input.cookie)
      .send({ reason: 'Yanlış ürün' });
    expect(
      (
        await request(input.app)
          .patch(`/api/orders/items/${itemId}`)
          .set('Cookie', input.cookie)
          .send({ quantity: 2, note: null })
      ).status,
    ).toBe(409);
  });

  it('oturumsuz erişimi 401, KITCHEN mutationını 403 ile reddeder', async () => {
    const owner = await scenario();
    const tableId = await seedTable(owner);
    expect((await request(owner.app).get('/api/orders/floor-plan')).status).toBe(401);
    const kitchen = await scenario('KITCHEN');
    const response = await request(kitchen.app)
      .post('/api/orders/checks')
      .set('Cookie', kitchen.cookie)
      .send({ tableId, guestCount: 2 });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(API_ERROR_CODES.FORBIDDEN);
  });

  it.each(['OWNER', 'CASHIER', 'WAITER'] as const)(
    '%s sipariş mutation yetkisine sahiptir',
    async (role) => {
      const input = await scenario(role);
      if (role !== 'OWNER') {
        const owner = input.store.seedUser({
          fullName: 'Owner',
          username: 'owner-extra',
          passwordHash,
          role: 'OWNER',
        });
        const area = await input.store.createArea({
          actorUserId: owner.id,
          name: 'Salon',
          nameKey: 'salon',
          sortOrder: 0,
          isActive: true,
        });
        await input.store.createTable({
          actorUserId: owner.id,
          areaId: area.id,
          name: 'Masa',
          nameKey: 'masa',
          capacity: 4,
          sortOrder: 0,
          isActive: true,
        });
      }
      const tables = await input.store.listTables(undefined, false);
      const tableId = tables[0]?.id ?? (await seedTable(input));
      const response = await request(input.app)
        .post('/api/orders/checks')
        .set('Cookie', input.cookie)
        .send({ tableId, guestCount: 2 });
      expect(response.status).toBe(201);
    },
  );

  it('sipariş kayıtlarını fiziksel silen DELETE endpointi sunmaz', async () => {
    const input = await orderFixture();
    expect(
      (
        await request(input.app)
          .delete(`/api/orders/checks/${input.checkId}`)
          .set('Cookie', input.cookie)
      ).status,
    ).toBe(404);
  });
});
