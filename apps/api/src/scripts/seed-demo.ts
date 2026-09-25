/**
 * Vitrin ve deneme için örnek veri üretir: menü, masalar, personel, son 30 günün
 * satışları, açık masalar, mutfak siparişleri, kasa, cari ve stok.
 *
 * Güvenlik: yalnız adı "demo" içeren ve hiç kullanıcısı olmayan bir veritabanında
 * çalışır. Gerçek işletme veritabanına yazmaz (AGENTS.md §9, §11).
 *
 * Kullanım: DATABASE_URL=".../KafeAdisyonDemo?schema=public" npm run demo:seed
 */
import dotenv from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import type { OptionSelectionType, PreparationArea, StockUnit, UserRole } from '@kafe/contracts';
import { ENV_FILE_PATH } from '../config/paths';
import { parseEnv } from '../config/env';
import { createPrismaClient } from '../lib/database';
import { createPrismaStore } from '../shared/prisma-store';
import type { AppStore } from '../shared/store';
import {
  IdentityService,
  normalizeNameKey,
  normalizeUsername,
} from '../modules/identity/identity-service';
import { hashPassword } from '../modules/identity/password';

/** Tüm demo hesaplarının şifresi; yalnız yerel demo veritabanı içindir. */
export const DEMO_PASSWORD = 'Demo1234!';
const DAYS_OF_HISTORY = 30;
/**
 * Demonun "şimdi"si. DEMO_NOW (ISO tarih) verilirse bugünün verisi o ana göre
 * üretilir; ekran görüntüsünü gece alırken bile gün içi bir an gösterilebilir.
 */
const NOW = process.env.DEMO_NOW === undefined ? new Date() : new Date(process.env.DEMO_NOW);
const MINUTE = 60_000;
const DAY = 86_400_000;

/** Tekrarlanabilir sonuç için tohumlu sözde rastgele sayı üreteci (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const random = createRandom(20260925);
const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Boş liste.');
  return item;
};
const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const chance = (probability: number): boolean => random() < probability;

interface ProductSeed {
  name: string;
  price: number;
  area: PreparationArea;
  /** Ürün başına satış ağırlığı; yüksek olan daha sık satılır. */
  weight: number;
  options?: Array<{
    name: string;
    type: OptionSelectionType;
    required: boolean;
    values: Array<[string, number]>;
  }>;
  recipe?: Array<[string, number]>;
}

const MILK_OPTIONS = {
  name: 'Süt',
  type: 'SINGLE' as const,
  required: true,
  values: [
    ['Tam yağlı', 0],
    ['Laktozsuz', 1_000],
    ['Yulaf sütü', 2_000],
  ] as Array<[string, number]>,
};
const EXTRA_OPTIONS = {
  name: 'Ekstra',
  type: 'MULTIPLE' as const,
  required: false,
  values: [
    ['Ekstra shot', 2_500],
    ['Karamel şurubu', 1_500],
    ['Vanilya şurubu', 1_500],
  ] as Array<[string, number]>,
};

const MENU: Array<{ category: string; products: ProductSeed[] }> = [
  {
    category: 'Sıcak Kahveler',
    products: [
      { name: 'Espresso', price: 7_000, area: 'BAR', weight: 4, recipe: [['Kahve çekirdeği', 18]] },
      {
        name: 'Americano',
        price: 9_500,
        area: 'BAR',
        weight: 7,
        recipe: [['Kahve çekirdeği', 18]],
      },
      {
        name: 'Latte',
        price: 12_000,
        area: 'BAR',
        weight: 10,
        options: [MILK_OPTIONS, EXTRA_OPTIONS],
        recipe: [
          ['Süt', 200],
          ['Kahve çekirdeği', 18],
        ],
      },
      {
        name: 'Cappuccino',
        price: 11_500,
        area: 'BAR',
        weight: 7,
        options: [MILK_OPTIONS],
        recipe: [
          ['Süt', 150],
          ['Kahve çekirdeği', 18],
        ],
      },
      {
        name: 'Flat White',
        price: 12_500,
        area: 'BAR',
        weight: 4,
        recipe: [
          ['Süt', 120],
          ['Kahve çekirdeği', 18],
        ],
      },
      {
        name: 'Türk Kahvesi',
        price: 8_000,
        area: 'BAR',
        weight: 8,
        options: [
          {
            name: 'Şeker',
            type: 'SINGLE',
            required: true,
            values: [
              ['Sade', 0],
              ['Az şekerli', 0],
              ['Orta', 0],
              ['Şekerli', 0],
            ],
          },
        ],
        recipe: [['Türk kahvesi', 7]],
      },
    ],
  },
  {
    category: 'Soğuk İçecekler',
    products: [
      {
        name: 'Iced Latte',
        price: 13_000,
        area: 'BAR',
        weight: 7,
        options: [MILK_OPTIONS, EXTRA_OPTIONS],
        recipe: [
          ['Süt', 180],
          ['Kahve çekirdeği', 18],
        ],
      },
      {
        name: 'Cold Brew',
        price: 12_500,
        area: 'BAR',
        weight: 4,
        recipe: [['Kahve çekirdeği', 25]],
      },
      { name: 'Ev Yapımı Limonata', price: 9_000, area: 'BAR', weight: 6, recipe: [['Limon', 2]] },
      {
        name: 'Taze Portakal Suyu',
        price: 11_000,
        area: 'BAR',
        weight: 4,
        recipe: [['Portakal', 3]],
      },
    ],
  },
  {
    category: 'Çaylar',
    products: [
      { name: 'Çay', price: 2_500, area: 'BAR', weight: 12, recipe: [['Çay', 5]] },
      { name: 'Fincan Çay', price: 4_000, area: 'BAR', weight: 5, recipe: [['Çay', 7]] },
      { name: 'Bitki Çayı', price: 7_000, area: 'BAR', weight: 3 },
    ],
  },
  {
    category: 'Kahvaltı',
    products: [
      {
        name: 'Serpme Kahvaltı (2 kişilik)',
        price: 65_000,
        area: 'KITCHEN',
        weight: 3,
        recipe: [['Yumurta', 4]],
      },
      { name: 'Menemen', price: 18_000, area: 'KITCHEN', weight: 5, recipe: [['Yumurta', 3]] },
      {
        name: 'Kaşarlı Tost',
        price: 15_000,
        area: 'KITCHEN',
        weight: 6,
        options: [
          {
            name: 'Ekmek',
            type: 'SINGLE',
            required: true,
            values: [
              ['Beyaz ekmek', 0],
              ['Tam buğday', 500],
            ],
          },
        ],
      },
      { name: 'Omlet', price: 17_000, area: 'KITCHEN', weight: 4, recipe: [['Yumurta', 3]] },
    ],
  },
  {
    category: 'Tatlılar',
    products: [
      { name: 'San Sebastian', price: 25_000, area: 'KITCHEN', weight: 6 },
      { name: 'Tiramisu', price: 22_000, area: 'KITCHEN', weight: 4 },
      {
        name: 'Sıcak Brownie',
        price: 18_000,
        area: 'KITCHEN',
        weight: 5,
        options: [
          {
            name: 'Yanında',
            type: 'MULTIPLE',
            required: false,
            values: [
              ['Dondurma', 4_000],
              ['Çikolata sos', 2_000],
            ],
          },
        ],
      },
      { name: 'Cookie', price: 9_000, area: 'KITCHEN', weight: 5 },
    ],
  },
];

/** Stok kalemleri ve seed sonunda görünecek hedef miktar (bazıları eşik altında). */
const STOCK: Array<{ name: string; unit: StockUnit; threshold: number; target: number }> = [
  { name: 'Süt', unit: 'MILLILITER', threshold: 5_000, target: 3_400 },
  { name: 'Kahve çekirdeği', unit: 'GRAM', threshold: 1_000, target: 4_250 },
  { name: 'Türk kahvesi', unit: 'GRAM', threshold: 250, target: 900 },
  { name: 'Çay', unit: 'GRAM', threshold: 500, target: 2_600 },
  { name: 'Limon', unit: 'PIECE', threshold: 20, target: 14 },
  { name: 'Portakal', unit: 'PIECE', threshold: 30, target: 48 },
  { name: 'Yumurta', unit: 'PIECE', threshold: 30, target: 96 },
];

const STAFF: Array<{ fullName: string; username: string; role: UserRole }> = [
  { fullName: 'Elif Yıldız', username: 'elif', role: 'CASHIER' },
  { fullName: 'Mert Demir', username: 'mert', role: 'WAITER' },
  { fullName: 'Zeynep Aydın', username: 'zeynep', role: 'WAITER' },
  { fullName: 'Ali Çelik', username: 'mutfak', role: 'KITCHEN' },
];

const AREAS: Array<{ name: string; prefix: string; tables: number[] }> = [
  { name: 'Salon', prefix: 'Masa', tables: [2, 2, 4, 4, 4, 6, 4, 2] },
  { name: 'Bahçe', prefix: 'Bahçe', tables: [4, 4, 6, 4, 2, 4] },
  { name: 'Teras', prefix: 'Teras', tables: [2, 2, 4, 4] },
];

const CUSTOMERS = [
  { name: 'Kat 3 Yazılım Ofisi', phone: '0212 555 01 03', note: 'Ay sonu toplu ödeme' },
  { name: 'Ahmet Korkmaz', phone: '0532 555 12 34', note: null },
  { name: 'Moda Mimarlık', phone: '0216 555 44 20', note: 'Toplantı ikramları' },
];

interface Context {
  client: PrismaClient;
  store: AppStore;
  ownerId: string;
  cashierId: string;
  waiterIds: string[];
  kitchenId: string;
  tables: Array<{ id: string }>;
  products: Array<{
    id: string;
    weight: number;
    groups: Array<{ required: boolean; type: OptionSelectionType; valueIds: string[] }>;
  }>;
  customerIds: string[];
}

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

async function seedPeopleAndPlaces(client: PrismaClient, store: AppStore) {
  const identity = new IdentityService(store);
  const owner = await identity.bootstrapOwner({
    businessName: 'Saydam Cafe',
    fullName: 'Deniz Kaya',
    username: 'demo',
    password: DEMO_PASSWORD,
  });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const staff = new Map<string, string>();
  for (const member of STAFF) {
    const created = await store.createStaff({
      actorUserId: owner.id,
      fullName: member.fullName,
      username: normalizeUsername(member.username),
      passwordHash,
      role: member.role,
    });
    staff.set(member.username, created.id);
  }
  const tables: Array<{ id: string }> = [];
  for (const [areaIndex, area] of AREAS.entries()) {
    const created = await store.createArea({
      actorUserId: owner.id,
      name: area.name,
      nameKey: normalizeNameKey(area.name),
      sortOrder: areaIndex,
      isActive: true,
    });
    for (const [index, capacity] of area.tables.entries()) {
      const name = `${area.prefix} ${index + 1}`;
      tables.push(
        await store.createTable({
          actorUserId: owner.id,
          areaId: created.id,
          name,
          nameKey: normalizeNameKey(name),
          capacity,
          sortOrder: index,
          isActive: true,
        }),
      );
    }
  }
  await client.businessSettings.update({
    where: { id: 'business' },
    data: { phone: '0216 555 00 00', address: 'Moda Cad. No: 12, Kadıköy / İstanbul' },
  });
  return {
    ownerId: owner.id,
    cashierId: staff.get('elif') ?? owner.id,
    waiterIds: [staff.get('mert'), staff.get('zeynep')].filter(
      (id): id is string => id !== undefined,
    ),
    kitchenId: staff.get('mutfak') ?? owner.id,
    tables,
  };
}

async function seedMenuAndStock(store: AppStore, ownerId: string) {
  const stockIds = new Map<string, string>();
  for (const item of STOCK) {
    const created = await store.createStockItem({
      actorUserId: ownerId,
      name: item.name,
      nameKey: normalizeNameKey(item.name),
      unit: item.unit,
      lowStockThreshold: item.threshold,
      isActive: true,
    });
    stockIds.set(item.name, created.id);
  }
  const products: Context['products'] = [];
  for (const [categoryIndex, section] of MENU.entries()) {
    const category = await store.createCategory({
      actorUserId: ownerId,
      name: section.category,
      nameKey: normalizeNameKey(section.category),
      sortOrder: categoryIndex,
      isActive: true,
    });
    for (const [productIndex, seed] of section.products.entries()) {
      const product = await store.createProduct({
        actorUserId: ownerId,
        categoryId: category.id,
        name: seed.name,
        nameKey: normalizeNameKey(seed.name),
        priceKurus: seed.price,
        preparationArea: seed.area,
        sortOrder: productIndex,
        isActive: true,
      });
      const groups: Context['products'][number]['groups'] = [];
      for (const [groupIndex, option] of (seed.options ?? []).entries()) {
        const group = await store.createOptionGroup({
          actorUserId: ownerId,
          productId: product.id,
          name: option.name,
          nameKey: normalizeNameKey(option.name),
          selectionType: option.type,
          isRequired: option.required,
          sortOrder: groupIndex,
          isActive: true,
        });
        const valueIds: string[] = [];
        for (const [valueIndex, [name, delta]] of option.values.entries()) {
          const value = await store.createOptionValue({
            actorUserId: ownerId,
            groupId: group.id,
            name,
            nameKey: normalizeNameKey(name),
            priceDeltaKurus: delta,
            sortOrder: valueIndex,
            isActive: true,
          });
          valueIds.push(value.id);
        }
        groups.push({ required: option.required, type: option.type, valueIds });
      }
      if (seed.recipe !== undefined) {
        await store.setProductRecipe({
          actorUserId: ownerId,
          productId: product.id,
          lines: seed.recipe.map(([name, quantityPerUnit]) => {
            const stockItemId = stockIds.get(name);
            if (stockItemId === undefined) throw new Error(`Stok kalemi yok: ${name}`);
            return { stockItemId, quantityPerUnit };
          }),
        });
      }
      products.push({ id: product.id, weight: seed.weight, groups });
    }
  }
  return { products, stockIds };
}

function pickProduct(context: Context) {
  const total = context.products.reduce((sum, product) => sum + product.weight, 0);
  let roll = random() * total;
  for (const product of context.products) {
    roll -= product.weight;
    if (roll < 0) return product;
  }
  return pick(context.products);
}

function pickOptions(product: Context['products'][number]): string[] {
  const ids: string[] = [];
  for (const group of product.groups) {
    if (group.type === 'SINGLE') {
      if (group.required || chance(0.4)) ids.push(pick(group.valueIds));
    } else {
      for (const id of group.valueIds) if (chance(0.2)) ids.push(id);
    }
  }
  return ids;
}

/** Masaya adisyon açar ve 1–5 kalem ekler; açılış zamanını geri tarihler. */
async function openWithItems(context: Context, tableId: string, openedAt: Date) {
  const waiter = pick(context.waiterIds);
  let check = await context.store.openCheck({
    actorUserId: waiter,
    tableId,
    guestCount: between(1, 4),
  });
  const lines = between(1, 5);
  for (let index = 0; index < lines; index += 1) {
    const product = pickProduct(context);
    check = await context.store.addOrderItem({
      actorUserId: waiter,
      checkId: check.id,
      productId: product.id,
      quantity: chance(0.25) ? 2 : 1,
      note: chance(0.08) ? pick(['Az buzlu', 'Sıcak olsun', 'Acısız', 'Paket']) : null,
      optionValueIds: pickOptions(product),
    });
  }
  await context.client.check.update({ where: { id: check.id }, data: { openedAt } });
  const items = check.items.map((item) => item.id);
  for (const [index, id] of items.entries()) {
    await context.client.orderItem.update({
      where: { id },
      data: { createdAt: new Date(openedAt.getTime() + (2 + index) * MINUTE) },
    });
  }
  return check;
}

/** Geçmiş bir adisyonu ödeme ve kapanışıyla tamamlar, tüm zamanları geri tarihler. */
async function completeSale(context: Context, tableId: string, openedAt: Date) {
  let check = await openWithItems(context, tableId, openedAt);
  const { store, client, cashierId } = context;
  const first = check.items[0];
  if (first !== undefined && chance(0.04)) {
    check = await store.cancelOrderItem({
      actorUserId: cashierId,
      itemId: first.id,
      reason: 'Yanlış giriş',
    });
  }
  const last = check.items.at(-1);
  if (last !== undefined && last.cancelledAt === null && chance(0.03)) {
    check = await store.makeOrderItemComplimentary({
      actorUserId: cashierId,
      itemId: last.id,
      reason: 'Müdavim ikramı',
    });
  }
  if (check.totalKurus > 0 && chance(0.05)) {
    check = await store.applyDiscount({
      actorUserId: cashierId,
      checkId: check.id,
      type: 'PERCENT',
      value: 10,
      reason: 'Öğrenci indirimi',
    });
  }
  if (check.remainingKurus > 0) {
    if (chance(0.03) && context.customerIds.length > 0) {
      check = await store.transferCheckToAccount({
        actorUserId: cashierId,
        customerId: pick(context.customerIds),
        checkId: check.id,
      });
    } else if (chance(0.1) && check.remainingKurus >= 2_000) {
      const cash = Math.round(check.remainingKurus / 2 / 100) * 100;
      check = await store.addPayment({
        actorUserId: cashierId,
        checkId: check.id,
        method: 'CASH',
        amountKurus: cash,
        cashReceivedKurus: cash,
      });
      check = await store.addPayment({
        actorUserId: cashierId,
        checkId: check.id,
        method: 'CARD',
        amountKurus: check.remainingKurus,
        cashReceivedKurus: null,
      });
    } else {
      const method = chance(0.6) ? 'CARD' : 'CASH';
      check = await store.addPayment({
        actorUserId: cashierId,
        checkId: check.id,
        method,
        amountKurus: check.remainingKurus,
        cashReceivedKurus:
          method === 'CASH' ? Math.ceil(check.remainingKurus / 5_000) * 5_000 : null,
      });
    }
  }
  check = await store.closeCheck({ actorUserId: cashierId, checkId: check.id });
  const closedAt = new Date(openedAt.getTime() + between(25, 80) * MINUTE);
  await client.check.update({ where: { id: check.id }, data: { closedAt } });
  await client.payment.updateMany({ where: { checkId: check.id }, data: { createdAt: closedAt } });
  await client.stockMovement.updateMany({
    where: { checkId: check.id },
    data: { createdAt: closedAt },
  });
  await client.accountEntry.updateMany({
    where: { checkId: check.id },
    data: { createdAt: closedAt },
  });
  await client.checkDiscount.updateMany({
    where: { checkId: check.id },
    data: { createdAt: closedAt },
  });
  await client.orderItem.updateMany({
    where: { checkId: check.id, cancelledAt: { not: null } },
    data: { cancelledAt: new Date(openedAt.getTime() + 5 * MINUTE) },
  });
  await client.orderItem.updateMany({
    where: { checkId: check.id, complimentaryAt: { not: null } },
    data: { complimentaryAt: closedAt },
  });
  await client.orderItem.updateMany({
    where: { checkId: check.id, cancelledAt: null },
    data: { preparationStatus: 'SERVED' },
  });
  return closedAt;
}

/** Günün saatine göre yoğunluk: kahvaltı, öğle ve akşamüstü tepe yapar. */
function randomTimeOfDay(dayStart: Date): Date {
  const slot = pick([
    [9, 11],
    [9, 11],
    [10, 12],
    [12, 15],
    [13, 15],
    [15, 18],
    [16, 19],
    [17, 21],
    [19, 22],
  ] as const);
  const minutes = between(slot[0] * 60, slot[1] * 60 - 30);
  return new Date(dayStart.getTime() + minutes * MINUTE);
}

/** Europe/Istanbul takvim gününün 00:00'ı (UTC+3, yaz saati yok). */
function istanbulDayStart(daysAgo: number): Date {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(NOW);
  return new Date(new Date(`${today}T00:00:00+03:00`).getTime() - daysAgo * DAY);
}

async function seedHistory(context: Context): Promise<void> {
  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 1; daysAgo -= 1) {
    const dayStart = istanbulDayStart(daysAgo);
    const weekday = new Date(dayStart.getTime() + 12 * 60 * MINUTE).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const checks = weekend ? between(22, 30) : between(12, 19);
    const times = Array.from({ length: checks }, () => randomTimeOfDay(dayStart)).sort(
      (left, right) => left.getTime() - right.getTime(),
    );
    for (const openedAt of times) {
      await completeSale(context, pick(context.tables).id, openedAt);
    }
    // Her gün için kapanmış bir kasa vardiyası (son 7 gün).
    if (daysAgo <= 7) await seedClosedShift(context, dayStart);
  }
}

async function seedClosedShift(context: Context, dayStart: Date): Promise<void> {
  const { store, client, cashierId } = context;
  const openedAt = new Date(dayStart.getTime() + 8 * 60 * MINUTE + 30 * MINUTE);
  const closedAt = new Date(dayStart.getTime() + 22 * 60 * MINUTE + 30 * MINUTE);
  const opening = 100_000;
  const session = await store.openCashSession({
    actorUserId: cashierId,
    openingCashKurus: opening,
    note: null,
  });
  const outAmount = between(2, 6) * 5_000;
  await store.addCashMovement({
    actorUserId: cashierId,
    type: 'OUT',
    amountKurus: outAmount,
    reason: 'Manav alışverişi',
  });
  await store.closeCashSession({ actorUserId: cashierId, countedCashKurus: 0, note: null });
  const cash = await client.payment.aggregate({
    where: { method: 'CASH', createdAt: { gte: openedAt, lt: closedAt } },
    _sum: { amountKurus: true },
  });
  const expected = opening + (cash._sum.amountKurus ?? 0) - outAmount;
  const difference = pick([0, 0, 0, -500, 1_000, -2_000]);
  await client.cashSession.update({
    where: { id: session.id },
    data: {
      openedAt,
      closedAt,
      expectedCashKurus: expected,
      countedCashKurus: expected + difference,
      closingNote: difference === 0 ? null : 'Sayımda fark çıktı',
    },
  });
  await client.cashMovement.updateMany({
    where: { sessionId: session.id },
    data: { createdAt: new Date(openedAt.getTime() + 3 * 60 * MINUTE) },
  });
}

/** Bugün: açık kasa, kapanmış birkaç satış, açık masalar ve mutfak siparişleri. */
async function seedToday(context: Context): Promise<void> {
  const { store, client, cashierId, kitchenId } = context;
  const now = NOW.getTime();
  const openedAt = new Date(now - 6 * 60 * MINUTE);
  const session = await store.openCashSession({
    actorUserId: cashierId,
    openingCashKurus: 100_000,
    note: 'Sabah vardiyası',
  });
  await client.cashSession.update({ where: { id: session.id }, data: { openedAt } });
  await store.addCashMovement({
    actorUserId: cashierId,
    type: 'IN',
    amountKurus: 20_000,
    reason: 'Bozuk para',
  });
  await store.addCashMovement({
    actorUserId: cashierId,
    type: 'OUT',
    amountKurus: 35_000,
    reason: 'Süt ve limon alımı',
  });
  await client.cashMovement.updateMany({
    where: { sessionId: session.id },
    data: { createdAt: new Date(now - 4 * 60 * MINUTE) },
  });

  const busy = context.tables.slice(0, 7).map((table) => table.id);
  const free = context.tables.slice(7);
  for (let index = 0; index < 14; index += 1) {
    await completeSale(context, pick(free).id, new Date(now - between(90, 330) * MINUTE));
  }

  // Açık masalar; mutfak ekranında her durumdan sipariş görünsün.
  for (const [index, tableId] of busy.entries()) {
    const openedCheckAt = new Date(now - between(30, 55) * MINUTE);
    const check = await openWithItems(context, tableId, openedCheckAt);
    for (const [itemIndex, item] of check.items.entries()) {
      const target = (index + itemIndex) % 4;
      const steps = ['PREPARING', 'READY', 'SERVED'] as const;
      for (const status of steps.slice(0, target)) {
        await store.updateOrderItemStatus({ actorUserId: kitchenId, itemId: item.id, status });
      }
      // Bekleme süresi duruma uygun: yeni siparişler taze, hazır olanlar daha eski.
      const ageRanges: Array<[number, number]> = [
        [1, 8],
        [6, 14],
        [12, 20],
        [18, 28],
      ];
      const [minAge, maxAge] = ageRanges[target] ?? [1, 8];
      await client.orderItem.update({
        where: { id: item.id },
        data: { createdAt: new Date(now - between(minAge, maxAge) * MINUTE) },
      });
    }
  }
}

async function seedAccounts(context: Context): Promise<void> {
  for (const customer of CUSTOMERS) {
    const created = await context.store.createCustomer({
      actorUserId: context.ownerId,
      name: customer.name,
      phone: customer.phone,
      note: customer.note,
      isActive: true,
    });
    context.customerIds.push(created.id);
  }
}

async function settleAccountsAndStock(
  context: Context,
  stockIds: Map<string, string>,
): Promise<void> {
  const { store, client, ownerId, cashierId } = context;
  const firstCustomer = context.customerIds[0];
  if (firstCustomer !== undefined) {
    await store.addAccountEntry({
      actorUserId: cashierId,
      customerId: firstCustomer,
      type: 'COLLECTION',
      amountKurus: 50_000,
      description: 'Havale ile kısmi ödeme',
    });
    await client.accountEntry.updateMany({
      where: { customerId: firstCustomer, type: 'COLLECTION' },
      data: { createdAt: new Date(NOW.getTime() - 3 * DAY) },
    });
  }
  const purchaseAt = new Date(istanbulDayStart(DAYS_OF_HISTORY + 1).getTime() + 10 * 60 * MINUTE);
  for (const item of STOCK) {
    const id = stockIds.get(item.name);
    if (id === undefined) continue;
    const sum = await client.stockMovement.aggregate({
      where: { stockItemId: id },
      _sum: { quantityDelta: true },
    });
    const purchase = item.target - (sum._sum.quantityDelta ?? 0);
    if (purchase <= 0) continue;
    await store.addStockMovement({
      actorUserId: ownerId,
      stockItemId: id,
      type: 'PURCHASE',
      quantity: purchase,
      reason: 'Açılış stoğu ve haftalık tedarik',
    });
    await client.stockMovement.updateMany({
      where: { stockItemId: id, type: 'PURCHASE' },
      data: { createdAt: purchaseAt },
    });
  }
}

async function main(): Promise<number> {
  dotenv.config({ path: ENV_FILE_PATH });
  const env = parseEnv(process.env);
  if (Number.isNaN(NOW.getTime())) {
    process.stderr.write(
      'DEMO_NOW geçerli bir ISO tarih olmalıdır (ör. 2026-09-25T15:40:00+03:00).\n',
    );
    return 1;
  }
  const name = databaseName(env.DATABASE_URL);
  if (!/demo/i.test(name)) {
    process.stderr.write(
      `"${name}" bir demo veritabanı değil. Demo verisi yalnız adı "demo" içeren boş bir veritabanına yazılır.\n`,
    );
    return 1;
  }
  const client = createPrismaClient(env.DATABASE_URL);
  try {
    if ((await client.user.count()) > 0) {
      process.stderr.write(`"${name}" boş değil; demo verisi yalnız boş veritabanına yazılır.\n`);
      return 1;
    }
    const store = createPrismaStore(client);
    process.stdout.write('Personel, salon ve masalar…\n');
    const people = await seedPeopleAndPlaces(client, store);
    process.stdout.write('Menü, seçenekler, reçeteler ve stok…\n');
    const menu = await seedMenuAndStock(store, people.ownerId);
    const context: Context = { client, store, ...people, products: menu.products, customerIds: [] };
    await seedAccounts(context);
    process.stdout.write(`Son ${DAYS_OF_HISTORY} günün satışları (birkaç dakika sürebilir)…\n`);
    await seedHistory(context);
    process.stdout.write('Bugün: kasa, açık masalar ve mutfak…\n');
    await seedToday(context);
    await settleAccountsAndStock(context, menu.stockIds);
    const checks = await client.check.count({ where: { status: 'PAID' } });
    process.stdout.write(
      `Hazır: ${checks} kapanmış adisyon. Giriş: demo / ${DEMO_PASSWORD} ` +
        `(kasiyer: elif, garson: mert, mutfak: mutfak — aynı şifre)\n`,
    );
    return 0;
  } finally {
    await client.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `Demo verisi üretilemedi: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
