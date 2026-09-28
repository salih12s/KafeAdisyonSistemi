/**
 * Gerçek MySQL/MariaDB'ye karşı integration testleri (ADR-026). Mock ile test
 * edilemeyen şeyler burada sınanır: eşzamanlı isteklerde veritabanı kısıtları
 * ve demo tazelemenin yazdığı SQL.
 *
 * Çalıştırma: `npm run test:db -w @kafe/api`. Bağlantı apps/api/.env.test içindeki
 * DATABASE_URL'dir; veritabanı adı hem "test" hem "demo" içermelidir, çünkü her
 * test başında tüm kayıtlar silinir (bkz. wipeDemoData).
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_ROOT } from '../../src/config/paths';
import { databaseNameOf, isDemoDatabaseName } from '../../src/config/database-url';
import { createPrismaClient } from '../../src/lib/database';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createPrismaStore } from '../../src/shared/prisma-store';
import { StoreError, type AppStore } from '../../src/shared/store';
import { IdentityService, normalizeNameKey } from '../../src/modules/identity/identity-service';
import { wipeDemoData } from '../../src/modules/demo/demo-seed';
import { freshenLiveChecks } from '../../src/modules/demo/demo-maintenance';
import { ensureDemoSchema } from '../../src/modules/demo/demo-schema';
import {
  LIVE_CHECK_AGE_SPAN_MS,
  LIVE_CHECK_MIN_AGE_MS,
} from '../../src/modules/demo/demo-schedule';

const MINUTE = 60_000;

function testDatabaseUrl(): string {
  const file = path.join(API_ROOT, '.env.test');
  const url = fs.existsSync(file)
    ? dotenv.parse(fs.readFileSync(file)).DATABASE_URL
    : process.env.TEST_DATABASE_URL;
  if (url === undefined) {
    throw new Error('apps/api/.env.test içinde DATABASE_URL (test veritabanı) tanımlı değil.');
  }
  const name = databaseNameOf(url);
  if (!/test/i.test(name) || !isDemoDatabaseName(name)) {
    throw new Error(`"${name}" test veritabanı değil; adı "test" ve "demo" içermelidir.`);
  }
  return url;
}

let client: PrismaClient;
let store: AppStore;

beforeAll(async () => {
  const url = testDatabaseUrl();
  // Boş test veritabanında şemayı canlı demonun ilk kurulumuyla aynı kod kurar.
  await ensureDemoSchema(url);
  client = createPrismaClient(url);
  store = createPrismaStore(client);
});

afterAll(async () => {
  await client?.$disconnect();
});

// Isolation: her test kendi verisini kurar; sıra değişse de sonuç değişmez.
beforeEach(async () => {
  await wipeDemoData(client);
});

/** Fixture: sahip, bir salon, bir masa ve bir ürün. */
async function cafe() {
  const owner = await new IdentityService(store).bootstrapOwner({
    businessName: 'Test Kafe',
    fullName: 'Test Sahibi',
    username: 'sahip',
    password: 'TestSahip12!',
  });
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
    nameKey: normalizeNameKey('Masa 1'),
    capacity: 4,
    sortOrder: 0,
    isActive: true,
  });
  const category = await store.createCategory({
    actorUserId: owner.id,
    name: 'Sıcak',
    nameKey: 'sıcak',
    sortOrder: 0,
    isActive: true,
  });
  const product = await store.createProduct({
    actorUserId: owner.id,
    categoryId: category.id,
    name: 'Çay',
    nameKey: 'çay',
    priceKurus: 3_000,
    preparationArea: 'BAR',
    sortOrder: 0,
    isActive: true,
  });
  return { owner, table, product };
}

function conflicts(results: PromiseSettledResult<unknown>[]): number {
  return results.filter(
    (result) =>
      result.status === 'rejected' &&
      result.reason instanceof StoreError &&
      result.reason.code === 'CONFLICT',
  ).length;
}

describe('Masa başına tek açık adisyon (generated kolon + unique index)', () => {
  it('aynı masaya eşzamanlı 5 açılıştan yalnız biri başarılı olur, kalanlar CONFLICT', async () => {
    const { owner, table } = await cafe();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        store.openCheck({ actorUserId: owner.id, tableId: table.id, guestCount: 2 }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(conflicts(results)).toBe(4);
    expect(await client.check.count({ where: { tableId: table.id, status: 'OPEN' } })).toBe(1);
  });

  it('uygulama kontrolü atlansa bile veritabanı ikinci açık adisyonu reddeder', async () => {
    const { owner, table } = await cafe();
    await store.openCheck({ actorUserId: owner.id, tableId: table.id, guestCount: 1 });
    await expect(
      client.check.create({
        data: { tableId: table.id, openedByUserId: owner.id, guestCount: 1 },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('adisyon kapanınca (OPEN değil) masaya yenisi açılabilir', async () => {
    const { owner, table } = await cafe();
    const first = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 1,
    });
    await client.check.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });
    const second = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 1,
    });
    expect(second.id).not.toBe(first.id);
  });
});

describe('Tek açık kasa oturumu', () => {
  it('eşzamanlı 3 kasa açılışından yalnız biri başarılı olur', async () => {
    const { owner } = await cafe();
    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        store.openCashSession({ actorUserId: owner.id, openingCashKurus: 10_000, note: null }),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(conflicts(results)).toBe(2);
  });
});

describe('Veritabanı CHECK kısıtları', () => {
  it('negatif tutarlı ödemeyi veritabanı da reddeder (API doğrulaması atlansa bile)', async () => {
    const { owner, table } = await cafe();
    const check = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 1,
    });
    await expect(
      client.payment.create({
        data: { checkId: check.id, method: 'CASH', amountKurus: -500, receivedByUserId: owner.id },
      }),
    ).rejects.toThrow();
  });
});

describe('Demo tazeleme (freshenLiveChecks)', () => {
  it('sabahtan kalan açık masayı ve kalemlerini 25–75 dakika yaşa çeker', async () => {
    const { owner, table, product } = await cafe();
    const check = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 2,
    });
    await store.addOrderItem({
      actorUserId: owner.id,
      checkId: check.id,
      productId: product.id,
      quantity: 1,
      note: null,
      optionValueIds: [],
    });
    const now = new Date();
    const elevenHoursAgo = new Date(now.getTime() - 11 * 60 * MINUTE);
    await client.check.update({ where: { id: check.id }, data: { openedAt: elevenHoursAgo } });
    await client.orderItem.updateMany({
      where: { checkId: check.id },
      data: { createdAt: new Date(elevenHoursAgo.getTime() + 2 * MINUTE) },
    });

    expect(await freshenLiveChecks(client, now)).toBe(1);

    const after = await client.check.findUniqueOrThrow({
      where: { id: check.id },
      include: { items: true },
    });
    const age = now.getTime() - after.openedAt.getTime();
    expect(age).toBeGreaterThanOrEqual(LIVE_CHECK_MIN_AGE_MS);
    expect(age).toBeLessThan(LIVE_CHECK_MIN_AGE_MS + LIVE_CHECK_AGE_SPAN_MS);
    const item = after.items[0];
    // Kalem adisyonla aynı miktarda kaydı: açılıştan 2 dakika sonra girilmiş görünür.
    expect(item?.createdAt.getTime()).toBe(after.openedAt.getTime() + 2 * MINUTE);
  });

  it('masaya az önce eklenen kalemi geleceğe kaydırmaz', async () => {
    const { owner, table, product } = await cafe();
    const check = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 2,
    });
    await store.addOrderItem({
      actorUserId: owner.id,
      checkId: check.id,
      productId: product.id,
      quantity: 1,
      note: null,
      optionValueIds: [],
    });
    const now = new Date();
    await client.check.update({
      where: { id: check.id },
      data: { openedAt: new Date(now.getTime() - 3 * 60 * MINUTE) },
    });

    await freshenLiveChecks(client, now);

    const item = await client.orderItem.findFirstOrThrow({ where: { checkId: check.id } });
    expect(item.createdAt.getTime()).toBeLessThanOrEqual(Date.now() - MINUTE + 1_000);
  });

  it('yaşı aralıkta (40 dk) olan açık masaya dokunmaz', async () => {
    const { owner, table } = await cafe();
    const check = await store.openCheck({
      actorUserId: owner.id,
      tableId: table.id,
      guestCount: 2,
    });
    const now = new Date();
    const openedAt = new Date(now.getTime() - 40 * MINUTE);
    await client.check.update({ where: { id: check.id }, data: { openedAt } });

    expect(await freshenLiveChecks(client, now)).toBe(0);
    const after = await client.check.findUniqueOrThrow({ where: { id: check.id } });
    expect(after.openedAt.getTime()).toBe(openedAt.getTime());
  });
});

describe('Demo şema kurulumu (ensureDemoSchema)', () => {
  it('tablolar varken hiçbir şey yapmaz; mevcut şemaya ve veriye dokunmaz', async () => {
    await cafe();
    expect(await ensureDemoSchema(testDatabaseUrl())).toBe(0);
    expect(await client.user.count()).toBe(1);
  });
});
