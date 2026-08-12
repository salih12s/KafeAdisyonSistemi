import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { createOrderEventHub } from '../src/features/order-events';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'PhaseSix12!';
let passwordHash = '';
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});
async function fixture(role: UserRole = 'OWNER') {
  const store = new MemoryStore();
  const user = store.seedUser({
    fullName: 'Personel',
    username: role.toLowerCase(),
    passwordHash,
    role,
  });
  const events = createOrderEventHub();
  const app = createTestApp({ databaseConnected: true, store, orderEvents: events });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: role.toLowerCase(), password: PASSWORD });
  const cookie = String(login.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
  const area = await store.createArea({
    actorUserId: user.id,
    name: 'Salon',
    nameKey: 'salon',
    sortOrder: 0,
    isActive: true,
  });
  const tableA = await store.createTable({
    actorUserId: user.id,
    areaId: area.id,
    name: 'Masa A',
    nameKey: 'masa a',
    capacity: 4,
    sortOrder: 0,
    isActive: true,
  });
  const tableB = await store.createTable({
    actorUserId: user.id,
    areaId: area.id,
    name: 'Masa B',
    nameKey: 'masa b',
    capacity: 4,
    sortOrder: 1,
    isActive: true,
  });
  const tableC = await store.createTable({
    actorUserId: user.id,
    areaId: area.id,
    name: 'Masa C',
    nameKey: 'masa c',
    capacity: 4,
    sortOrder: 2,
    isActive: true,
  });
  const category = await store.createCategory({
    actorUserId: user.id,
    name: 'Yemek',
    nameKey: 'yemek',
    sortOrder: 0,
    isActive: true,
  });
  const product = await store.createProduct({
    actorUserId: user.id,
    categoryId: category.id,
    name: 'Tost',
    nameKey: 'tost',
    priceKurus: 10000,
    preparationArea: 'KITCHEN',
    sortOrder: 0,
    isActive: true,
  });
  const check = await store.openCheck({ actorUserId: user.id, tableId: tableA.id, guestCount: 2 });
  const withItem = await store.addOrderItem({
    actorUserId: user.id,
    checkId: check.id,
    productId: product.id,
    quantity: 1,
    note: null,
    optionValueIds: [],
  });
  const customer = await store.createCustomer({
    actorUserId: user.id,
    name: 'Ayşe Yılmaz',
    phone: null,
    note: null,
    isActive: true,
  });
  return {
    store,
    user,
    events,
    app,
    cookie,
    tableA,
    tableB,
    tableC,
    product,
    check: withItem,
    customer,
  };
}

describe('Phase 6 cari, ayarlama ve masa işlemleri', () => {
  it('ledger borç/tahsilat bakiyesini hesaplar ve adisyon kalanını cariye aktarır', async () => {
    const x = await fixture();
    const transferred = await request(x.app)
      .post(`/api/orders/checks/${x.check.id}/account-transfer`)
      .set('Cookie', x.cookie)
      .send({ customerId: x.customer.id });
    expect(transferred.body.check).toMatchObject({ remainingKurus: 0 });
    expect(transferred.body.check.payments[0].method).toBe('ACCOUNT');
    expect((await x.store.getCustomer(x.customer.id)).balanceKurus).toBe(10000);
    await request(x.app)
      .post(`/api/accounts/${x.customer.id}/entries`)
      .set('Cookie', x.cookie)
      .send({ type: 'COLLECTION', amountKurus: 4000, description: 'Nakit tahsilat' });
    expect((await x.store.getCustomer(x.customer.id)).balanceKurus).toBe(6000);
    await x.store.addAccountEntry({
      actorUserId: x.user.id,
      customerId: x.customer.id,
      type: 'REFUND',
      amountKurus: 1000,
      description: 'İade',
    });
    await x.store.addAccountEntry({
      actorUserId: x.user.id,
      customerId: x.customer.id,
      type: 'CORRECTION',
      amountKurus: 500,
      description: 'Düzeltme',
    });
    expect((await x.store.getCustomer(x.customer.id)).balanceKurus).toBe(6500);
    expect(x.store.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['CHECK_TRANSFERRED_TO_ACCOUNT', 'ACCOUNT_COLLECTION']),
    );
  });
  it('yüzde/sabit indirimi hesaplar ve ödenenden fazla indirimi engeller', async () => {
    const x = await fixture();
    const discounted = await request(x.app)
      .post(`/api/orders/checks/${x.check.id}/discounts`)
      .set('Cookie', x.cookie)
      .send({ type: 'PERCENT', value: 10, reason: 'Kampanya' });
    expect(discounted.body.check.totalKurus).toBe(9000);
    expect(
      (
        await request(x.app)
          .post(`/api/orders/checks/${x.check.id}/discounts`)
          .set('Cookie', x.cookie)
          .send({ type: 'PERCENT', value: 101, reason: 'Geçersiz oran' })
      ).status,
    ).toBe(400);
    await x.store.addPayment({
      actorUserId: x.user.id,
      checkId: x.check.id,
      method: 'CARD',
      amountKurus: 8000,
      cashReceivedKurus: null,
    });
    const invalid = await request(x.app)
      .post(`/api/orders/checks/${x.check.id}/discounts`)
      .set('Cookie', x.cookie)
      .send({ type: 'FIXED', value: 2000, reason: 'Ek indirim' });
    expect(invalid.status).toBe(409);
  });
  it('kalemi gerekçeyle ikram eder ve toplamdan düşer', async () => {
    const x = await fixture();
    const response = await request(x.app)
      .post(`/api/orders/items/${x.check.items[0]?.id}/complimentary`)
      .set('Cookie', x.cookie)
      .send({ reason: 'İşletme ikramı' });
    expect(response.body.check.totalKurus).toBe(0);
    expect(response.body.check.items[0]).toMatchObject({ complimentaryReason: 'İşletme ikramı' });
    const discounted = await fixture();
    await discounted.store.applyDiscount({
      actorUserId: discounted.user.id,
      checkId: discounted.check.id,
      type: 'PERCENT',
      value: 10,
      reason: 'Kampanya',
    });
    expect(
      (
        await request(discounted.app)
          .post(`/api/orders/items/${discounted.check.items[0]?.id}/complimentary`)
          .set('Cookie', discounted.cookie)
          .send({ reason: 'İndirim sonrası ikram' })
      ).body.check.totalKurus,
    ).toBe(0);
  });
  it('boş masaya taşır, dolu masayı ve yarışan ikinci taşıma girişimini engeller', async () => {
    const x = await fixture();
    const other = await x.store.openCheck({
      actorUserId: x.user.id,
      tableId: x.tableB.id,
      guestCount: 1,
    });
    expect(
      (
        await request(x.app)
          .post(`/api/orders/checks/${x.check.id}/move`)
          .set('Cookie', x.cookie)
          .send({ targetTableId: x.tableB.id })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(x.app)
          .post(`/api/orders/checks/${x.check.id}/move`)
          .set('Cookie', x.cookie)
          .send({ targetTableId: x.tableC.id })
      ).status,
    ).toBe(200);
    expect((await x.store.getCheck(x.check.id)).tableId).toBe(x.tableC.id);
    expect(other.status).toBe('OPEN');
  });
  it('iki açık adisyonu kalem/ödeme/indirimleri koruyarak birleştirir', async () => {
    const x = await fixture();
    const source = await x.store.openCheck({
      actorUserId: x.user.id,
      tableId: x.tableB.id,
      guestCount: 1,
    });
    await x.store.addOrderItem({
      actorUserId: x.user.id,
      checkId: source.id,
      productId: x.product.id,
      quantity: 1,
      note: null,
      optionValueIds: [],
    });
    await x.store.addPayment({
      actorUserId: x.user.id,
      checkId: source.id,
      method: 'CARD',
      amountKurus: 1000,
      cashReceivedKurus: null,
    });
    await x.store.applyDiscount({
      actorUserId: x.user.id,
      checkId: x.check.id,
      type: 'FIXED',
      value: 500,
      reason: 'İndirim',
    });
    const merged = await request(x.app)
      .post(`/api/orders/checks/${x.check.id}/merge`)
      .set('Cookie', x.cookie)
      .send({ sourceCheckId: source.id });
    expect(merged.body.check.items).toHaveLength(2);
    expect(merged.body.check.payments).toHaveLength(1);
    expect(merged.body.check.discounts).toHaveLength(1);
    expect(await x.store.getCheck(source.id)).toMatchObject({
      status: 'MERGED',
      mergedIntoCheckId: x.check.id,
    });
  });
  it('yetkileri backendde uygular ve realtime eventleri yayınlar', async () => {
    const waiter = await fixture('WAITER');
    expect(
      (
        await request(waiter.app)
          .post(`/api/orders/checks/${waiter.check.id}/discounts`)
          .set('Cookie', waiter.cookie)
          .send({ type: 'FIXED', value: 100, reason: 'Test' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(waiter.app)
          .post(`/api/orders/checks/${waiter.check.id}/move`)
          .set('Cookie', waiter.cookie)
          .send({ targetTableId: waiter.tableB.id })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(waiter.app)
          .post(`/api/orders/checks/${waiter.check.id}/merge`)
          .set('Cookie', waiter.cookie)
          .send({ sourceCheckId: waiter.check.id })
      ).status,
    ).toBe(403);
    const owner = await fixture();
    const received: string[] = [];
    owner.events.subscribe((e) => received.push(e.type));
    await request(owner.app)
      .post(`/api/orders/checks/${owner.check.id}/discounts`)
      .set('Cookie', owner.cookie)
      .send({ type: 'FIXED', value: 100, reason: 'Test' });
    await request(owner.app)
      .post(`/api/orders/checks/${owner.check.id}/account-transfer`)
      .set('Cookie', owner.cookie)
      .send({ customerId: owner.customer.id });
    expect(received).toEqual(expect.arrayContaining(['CHECK_ADJUSTED', 'ACCOUNT_CHANGED']));
  });
});
