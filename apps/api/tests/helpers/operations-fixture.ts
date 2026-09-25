import { expect } from 'vitest';
import request from 'supertest';
import type { UserRole } from '@kafe/contracts';
import { hashPassword } from '../../src/modules/identity/password';
import { createTestApp } from './test-app';
import { MemoryStore } from './memory-store';

/**
 * Kasa, stok ve QR menü testlerinin ortak kurulumu: sahibi ve istenen rolde
 * oturumu açık, tek ürünlü (Latte, 120 TL) ve tek masalı bir uygulama.
 */

const PASSWORD = 'PhaseEight12!';
let cachedHash: Promise<string> | undefined;

function passwordHashOnce(): Promise<string> {
  cachedHash ??= hashPassword(PASSWORD);
  return cachedHash;
}

export async function login(
  app: ReturnType<typeof createTestApp>,
  username: string,
): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: PASSWORD });
  const cookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('Cookie yok.');
  return cookies[0].split(';')[0] ?? '';
}

/** Tek ürünlü açık bir adisyonu olan, OWNER ve istenen rolde oturumu hazır senaryo. */
export async function fixture(role: UserRole = 'OWNER') {
  const passwordHash = await passwordHashOnce();
  const store = new MemoryStore();
  const owner = await store.bootstrapOwner({
    businessName: 'Saydam Cafe',
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

export type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Masayı açar, `quantity` adet ürün ekler, nakit öder ve kapatır. */
export async function sellAndClose(input: Fixture, quantity: number, cancelOne = false) {
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
