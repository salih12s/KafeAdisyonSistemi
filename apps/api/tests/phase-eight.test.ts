import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { buildSalesReport } from '../src/features/report-calculations';
import { saleConsumption } from '../src/features/stock-calculations';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'PhaseEight12!';
let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

async function login(app: ReturnType<typeof createTestApp>, username: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: PASSWORD });
  const cookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Cookie yok.');
  return cookies[0].split(';')[0] ?? '';
}

/** Tek ürünlü açık bir adisyonu olan, OWNER ve istenen rolde oturumu hazır senaryo. */
async function fixture(role: UserRole = 'OWNER') {
  const store = new MemoryStore();
  const owner = await store.bootstrapOwner({
    businessName: 'Joker Cafe',
    fullName: 'İşletme Sahibi',
    username: 'owner',
    passwordHash,
  });
  if (role !== 'OWNER') {
    store.seedUser({ fullName: role, username: role.toLowerCase(), passwordHash, role });
  }
  const app = createTestApp({ databaseConnected: true, store });
  const ownerCookie = await login(app, 'owner');
  const cookie = role === 'OWNER' ? ownerCookie : await login(app, role.toLowerCase());
  const area = await store.createArea({
    actorUserId: owner.id,
    name: 'Salon',
    nameKey: 'salon',
    sortOrder: 0,
    isActive: true,
  });
  const table = await store.createTable({
    actorUserId: owner.id,
    areaId: area.id,
    name: 'Masa 1',
    nameKey: 'masa 1',
    capacity: 2,
    sortOrder: 0,
    isActive: true,
  });
  const category = await store.createCategory({
    actorUserId: owner.id,
    name: 'Kahveler',
    nameKey: 'kahveler',
    sortOrder: 0,
    isActive: true,
  });
  const product = await store.createProduct({
    actorUserId: owner.id,
    categoryId: category.id,
    name: 'Latte',
    nameKey: 'latte',
    priceKurus: 12_000,
    preparationArea: 'BAR',
    sortOrder: 0,
    isActive: true,
  });
  return { store, app, owner, ownerCookie, cookie, table, product };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Masayı açar, `quantity` adet ürün ekler, nakit öder ve kapatır. */
async function sellAndClose(input: Fixture, quantity: number, cancelOne = false) {
  const check = await input.store.openCheck({
    actorUserId: input.owner.id,
    tableId: input.table.id,
    guestCount: 1,
  });
  let current = await input.store.addOrderItem({
    actorUserId: input.owner.id,
    checkId: check.id,
    productId: input.product.id,
    quantity,
    note: null,
    optionValueIds: [],
  });
  if (cancelOne) {
    current = await input.store.addOrderItem({
      actorUserId: input.owner.id,
      checkId: check.id,
      productId: input.product.id,
      quantity: 5,
      note: null,
      optionValueIds: [],
    });
    const extra = current.items.at(-1);
    if (extra === undefined) throw new Error('Kalem yok.');
    current = await input.store.cancelOrderItem({
      actorUserId: input.owner.id,
      itemId: extra.id,
      reason: 'Yanlış giriş',
    });
  }
  await request(input.app)
    .post(`/api/orders/checks/${check.id}/payments`)
    .set('Cookie', input.ownerCookie)
    .send({
      method: 'CASH',
      amountKurus: current.totalKurus,
      cashReceivedKurus: current.totalKurus,
    })
    .expect(201);
  const closed = await request(input.app)
    .post(`/api/orders/checks/${check.id}/close`)
    .set('Cookie', input.ownerCookie);
  expect(closed.status).toBe(200);
  return current.totalKurus;
}

describe('Phase 8 kasa oturumu', () => {
  it('açılış, nakit satış, giriş/çıkış ve kapanışta beklenen tutarı ve farkı hesaplar', async () => {
    const input = await fixture('CASHIER');
    const opened = await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 50_000, note: 'Sabah' });
    expect(opened.status).toBe(201);
    expect(opened.body.session).toMatchObject({ status: 'OPEN', expectedCashKurus: 50_000 });

    const sale = await sellAndClose(input, 2);
    expect(sale).toBe(24_000);

    await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'IN', amountKurus: 10_000, reason: 'Bozuk para' })
      .expect(201);
    const out = await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'OUT', amountKurus: 4_000, reason: 'Süt alımı' });
    expect(out.body.session).toMatchObject({
      cashSalesKurus: 24_000,
      cashInKurus: 10_000,
      cashOutKurus: 4_000,
      expectedCashKurus: 80_000,
    });

    const closed = await request(input.app)
      .post('/api/cash/current/close')
      .set('Cookie', input.cookie)
      .send({ countedCashKurus: 79_500, note: null });
    expect(closed.status).toBe(200);
    expect(closed.body.session).toMatchObject({
      status: 'CLOSED',
      expectedCashKurus: 80_000,
      countedCashKurus: 79_500,
      differenceKurus: -500,
    });

    const current = await request(input.app).get('/api/cash/current').set('Cookie', input.cookie);
    expect(current.body.session).toBeNull();
    const history = await request(input.app).get('/api/cash/sessions').set('Cookie', input.cookie);
    expect(history.body.sessions).toHaveLength(1);
    // Kapanmış kasanın dökümü sabit beklenen tutarla tutarlıdır.
    expect(history.body.sessions[0]).toMatchObject({
      cashSalesKurus: 24_000,
      expectedCashKurus: 80_000,
      differenceKurus: -500,
    });
    expect(input.store.audits.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['CASH_SESSION_OPENED', 'CASH_MOVEMENT_ADDED', 'CASH_SESSION_CLOSED']),
    );
  });

  it('ikinci açık kasayı, açık kasa yokken hareketi ve geçersiz tutarı reddeder', async () => {
    const input = await fixture();
    const noSession = await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'IN', amountKurus: 100, reason: 'Deneme' });
    expect(noSession.status).toBe(409);

    await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 0 })
      .expect(201);
    const second = await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 0 });
    expect(second.status).toBe(409);

    for (const body of [
      { type: 'IN', amountKurus: 0, reason: 'Sıfır' },
      { type: 'OUT', amountKurus: 10.5, reason: 'Kesirli' },
      { type: 'OUT', amountKurus: 100, reason: '' },
    ]) {
      const invalid = await request(input.app)
        .post('/api/cash/current/movements')
        .set('Cookie', input.cookie)
        .send(body);
      expect(invalid.status).toBe(400);
    }
  });

  it('garson ve mutfak kasaya erişemez', async () => {
    for (const role of ['WAITER', 'KITCHEN'] as const) {
      const input = await fixture(role);
      const response = await request(input.app)
        .get('/api/cash/current')
        .set('Cookie', input.cookie);
      expect(response.status).toBe(403);
    }
  });
});

describe('Phase 8 stok ve reçete', () => {
  it('reçeteye göre kapanan adisyondan stok düşer; iptal edilen kalem düşmez', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Süt', unit: 'MILLILITER', lowStockThreshold: 1_000 });
    expect(created.status).toBe(201);
    const milkId: string = created.body.item.id;

    await request(input.app)
      .post(`/api/stock/items/${milkId}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 5_000, reason: 'Tedarikçi' })
      .expect(201);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: milkId, quantityPerUnit: 200 }] });
    expect(recipe.body.recipe.lines).toEqual([
      { stockItemId: milkId, stockItemName: 'Süt', unit: 'MILLILITER', quantityPerUnit: 200 },
    ]);

    await sellAndClose(input, 3, true);

    const detail = await request(input.app)
      .get(`/api/stock/items/${milkId}`)
      .set('Cookie', input.cookie);
    // 5000 − 3 × 200 = 4400; iptal edilen 5 adet düşülmez.
    expect(detail.body.item).toMatchObject({ balance: 4_400, isLow: false });
    expect(detail.body.item.movements[0]).toMatchObject({ type: 'SALE', quantityDelta: -600 });
  });

  it('sayım düzeltmesi farkı yazar, fire düşer ve eşik altı stok isLow olur', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Kahve çekirdeği', unit: 'GRAM', lowStockThreshold: 500 });
    const id: string = created.body.item.id;
    await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 1_000 })
      .expect(201);
    await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'WASTE', quantity: 100, reason: 'Döküldü' })
      .expect(201);
    const adjusted = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'ADJUSTMENT', countedQuantity: 450, reason: 'Akşam sayımı' });
    expect(adjusted.body.item).toMatchObject({ balance: 450, isLow: true });
    expect(adjusted.body.item.movements[0]).toMatchObject({
      type: 'ADJUSTMENT',
      quantityDelta: -450,
    });

    const same = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'ADJUSTMENT', countedQuantity: 450, reason: 'Tekrar sayım' });
    expect(same.status).toBe(400);
    const sale = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'SALE', quantity: 10 });
    expect(sale.status).toBe(400);
  });

  it('aynı adla ikinci stok kalemini ve reçetede tekrar eden kalemi reddeder', async () => {
    const input = await fixture();
    const body = { name: 'Şeker', unit: 'GRAM', lowStockThreshold: 0 };
    const first = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send(body);
    const duplicate = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ ...body, name: 'ŞEKER' });
    expect(duplicate.status).toBe(409);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({
        lines: [
          { stockItemId: first.body.item.id, quantityPerUnit: 5 },
          { stockItemId: first.body.item.id, quantityPerUnit: 10 },
        ],
      });
    expect(recipe.status).toBe(400);

    const tooLarge = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: first.body.item.id, quantityPerUnit: 100_001 }] });
    expect(tooLarge.status).toBe(400);
  });

  it('reçeteden çıkarılan satırı pasife alır, sonraki satışta düşmez', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Bardak', unit: 'PIECE', lowStockThreshold: 0 });
    const id: string = created.body.item.id;
    await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: id, quantityPerUnit: 1 }] })
      .expect(200);
    const cleared = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [] });
    expect(cleared.body.recipe.lines).toEqual([]);
    await sellAndClose(input, 2);
    const detail = await request(input.app)
      .get(`/api/stock/items/${id}`)
      .set('Cookie', input.cookie);
    expect(detail.body.item.balance).toBe(0);
  });

  it('kasiyer stok hareketi girer ama stok kalemi ve reçete tanımlayamaz; garson stoğu göremez', async () => {
    const input = await fixture('CASHIER');
    const item = await input.store.createStockItem({
      actorUserId: input.owner.id,
      name: 'Çay',
      nameKey: 'çay',
      unit: 'GRAM',
      lowStockThreshold: 0,
      isActive: true,
    });
    const movement = await request(input.app)
      .post(`/api/stock/items/${item.id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 250 });
    expect(movement.status).toBe(201);
    const create = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Limon', unit: 'PIECE', lowStockThreshold: 0 });
    expect(create.status).toBe(403);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [] });
    expect(recipe.status).toBe(403);

    const waiter = await fixture('WAITER');
    const list = await request(waiter.app).get('/api/stock/items').set('Cookie', waiter.cookie);
    expect(list.status).toBe(403);
  });

  it('satış tüketimini ürün bazında toplar ve iptalleri dışarıda bırakır', () => {
    const consumption = saleConsumption(
      [
        { productId: 'latte', quantity: 2, cancelled: false },
        { productId: 'latte', quantity: 1, cancelled: false },
        { productId: 'latte', quantity: 4, cancelled: true },
        { productId: 'mocha', quantity: 1, cancelled: false },
      ],
      [
        { productId: 'latte', stockItemId: 'milk', quantityPerUnit: 200 },
        { productId: 'mocha', stockItemId: 'milk', quantityPerUnit: 150 },
        { productId: 'mocha', stockItemId: 'chocolate', quantityPerUnit: 30 },
      ],
    );
    expect(Object.fromEntries(consumption)).toEqual({ milk: 750, chocolate: 30 });
  });
});

describe('Phase 8 QR menü (oturumsuz)', () => {
  it('oturum olmadan yalnız aktif ürünü olan kategorileri ve işletme adını döndürür', async () => {
    const input = await fixture();
    const empty = await input.store.createCategory({
      actorUserId: input.owner.id,
      name: 'Boş kategori',
      nameKey: 'boş kategori',
      sortOrder: 1,
      isActive: true,
    });
    const response = await request(input.app).get('/api/public/menu');
    expect(response.status).toBe(200);
    expect(response.body.businessName).toBe('Joker Cafe');
    expect(response.body.categories.map((category: { id: string }) => category.id)).not.toContain(
      empty.id,
    );
    expect(response.body.categories[0].products[0]).toMatchObject({
      name: 'Latte',
      priceKurus: 12_000,
    });
    expect(response.headers['cache-control']).toContain('max-age=60');
  });

  it('oturumsuz istek diğer uçlara erişemez', async () => {
    const input = await fixture();
    for (const path of ['/api/menu', '/api/stock/items', '/api/cash/current']) {
      expect((await request(input.app).get(path)).status).toBe(401);
    }
  });
});

describe('Phase 8 günlük satış kırılımı', () => {
  it('aralıktaki her günü sıfırlarla birlikte döndürür', () => {
    const report = buildSalesReport(
      {
        from: new Date('2026-08-10T21:00:00.000Z'),
        toExclusive: new Date('2026-08-13T21:00:00.000Z'),
        fromDate: '2026-08-11',
        toDate: '2026-08-13',
      },
      [],
    );
    expect(report.dailySales).toEqual([
      { date: '2026-08-11', totalKurus: 0, checkCount: 0 },
      { date: '2026-08-12', totalKurus: 0, checkCount: 0 },
      { date: '2026-08-13', totalKurus: 0, checkCount: 0 },
    ]);
  });

  it('kapanış saatini Istanbul gününe göre sayar (gece yarısı sonrası ertesi gündür)', async () => {
    const input = await fixture();
    await sellAndClose(input, 1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(),
    );
    const response = await request(input.app)
      .get(`/api/reports/sales?from=${today}&to=${today}`)
      .set('Cookie', input.cookie);
    expect(response.body.report.dailySales).toEqual([
      { date: today, totalKurus: 12_000, checkCount: 1 },
    ]);
  });
});
