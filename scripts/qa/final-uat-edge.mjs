import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createPrismaAccountStore } from '../../apps/api/src/features/prisma-account-store.ts';

const baseUrl = process.env.UAT_BASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const ownerPassword = process.env.UAT_OWNER_PASSWORD;
const staffPassword = process.env.UAT_STAFF_PASSWORD;
const outputDirectory = process.env.UAT_OUTPUT_DIR;
if (!baseUrl || !databaseUrl || !ownerPassword || !staffPassword || !outputDirectory) {
  throw new Error('EDGE UAT environment eksik.');
}

class Session {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.cookie = '';
  }
  async raw(method, pathname, body) {
    return fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async request(method, pathname, body, expected = 200) {
    const response = await this.raw(method, pathname, body);
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${pathname}: ${response.status} ${text}`);
    return text ? JSON.parse(text) : null;
  }
  async login() {
    const response = await this.raw('POST', '/api/auth/login', {
      username: this.username,
      password: this.password,
    });
    assert.equal(response.status, 200);
    this.cookie = (response.headers.get('set-cookie') ?? '').split(';', 1)[0] ?? '';
    return (await response.json()).user;
  }
}

const ownerA = new Session('edge_owner', ownerPassword);
const ownerB = new Session('edge_owner_b', staffPassword);

async function createArea(name, sortOrder) {
  return (await ownerA.request('POST', '/api/areas', { name, sortOrder, isActive: true }, 201))
    .area;
}
async function createTable(areaId, name, sortOrder) {
  return (
    await ownerA.request(
      'POST',
      '/api/tables',
      { areaId, name, capacity: 4, sortOrder, isActive: true },
      201,
    )
  ).table;
}
async function createCategory(name, sortOrder) {
  return (
    await ownerA.request('POST', '/api/menu/categories', { name, sortOrder, isActive: true }, 201)
  ).category;
}
async function createProduct(categoryId, name, priceKurus, preparationArea, sortOrder) {
  return (
    await ownerA.request(
      'POST',
      '/api/menu/products',
      { categoryId, name, priceKurus, preparationArea, sortOrder, isActive: true },
      201,
    )
  ).product;
}
async function open(tableId, guestCount = 3) {
  return (await ownerA.request('POST', '/api/orders/checks', { tableId, guestCount }, 201)).check;
}
async function add(checkId, productId, optionValueIds = []) {
  return (
    await ownerA.request(
      'POST',
      `/api/orders/checks/${checkId}/items`,
      { productId, quantity: 1, note: null, optionValueIds },
      201,
    )
  ).check;
}

async function main() {
  process.stdout.write('EDGE_STAGE setup\n');
  const ownerUserA = await ownerA.login();
  const ownerUserB = (
    await ownerA.request(
      'POST',
      '/api/staff',
      {
        fullName: 'EDGE Yedek Sahip',
        username: 'edge_owner_b',
        password: staffPassword,
        role: 'OWNER',
      },
      201,
    )
  ).staff;
  await ownerB.login();
  const area = await createArea('EDGE Salon', 1);
  const areaTwo = await createArea('EDGE Bahçe', 2);
  const areaThree = await createArea('EDGE Teras', 3);
  const fixtureAreas = [area, areaTwo, areaThree];
  const tables = [];
  for (let index = 1; index <= 40; index += 1) {
    tables.push(
      await createTable(
        fixtureAreas[(index - 1) % fixtureAreas.length].id,
        `EDGE Masa ${index}`,
        index,
      ),
    );
  }
  const category = await createCategory('EDGE Kategori', 1);
  const product = await createProduct(category.id, 'EDGE Ürün', 10_100, 'BAR', 1);

  process.stdout.write('EDGE_STAGE concurrency\n');
  const openResponses = await Promise.all([
    ownerA.raw('POST', '/api/orders/checks', { tableId: tables[0].id, guestCount: 2 }),
    ownerB.raw('POST', '/api/orders/checks', { tableId: tables[0].id, guestCount: 2 }),
  ]);
  assert.deepEqual(openResponses.map((response) => response.status).sort(), [201, 409]);
  const concurrentCheck = (await openResponses.find((response) => response.status === 201).json())
    .check;
  await add(concurrentCheck.id, product.id);
  const paymentResponses = await Promise.all([
    ownerA.raw('POST', `/api/orders/checks/${concurrentCheck.id}/payments`, {
      method: 'CARD',
      amountKurus: 6_000,
      cashReceivedKurus: null,
    }),
    ownerB.raw('POST', `/api/orders/checks/${concurrentCheck.id}/payments`, {
      method: 'CARD',
      amountKurus: 6_000,
      cashReceivedKurus: null,
    }),
  ]);
  assert.deepEqual(paymentResponses.map((response) => response.status).sort(), [201, 409]);
  const paymentCheck = (await ownerA.request('GET', `/api/orders/checks/${concurrentCheck.id}`))
    .check;
  assert.equal(paymentCheck.paidKurus, 6_000);

  const statusCheck = await open(tables[1].id);
  const statusItem = (await add(statusCheck.id, product.id)).items[0];
  const statusResponses = await Promise.all([
    ownerA.raw('PATCH', `/api/orders/items/${statusItem.id}/status`, { status: 'PREPARING' }),
    ownerB.raw('PATCH', `/api/orders/items/${statusItem.id}/status`, { status: 'PREPARING' }),
  ]);
  assert.deepEqual(statusResponses.map((response) => response.status).sort(), [200, 409]);

  const ownerResponses = await Promise.all([
    ownerA.raw('PATCH', `/api/staff/${ownerUserB.id}`, {
      fullName: 'EDGE Yedek Sahip',
      role: 'OWNER',
      isActive: false,
    }),
    ownerB.raw('PATCH', `/api/staff/${ownerUserA.id}`, {
      fullName: 'EDGE Ana Sahip',
      role: 'OWNER',
      isActive: false,
    }),
  ]);
  assert.deepEqual(ownerResponses.map((response) => response.status).sort(), [200, 409]);

  const activeOwner = ownerResponses[0].status === 200 ? ownerA : ownerB;
  ownerA.cookie = activeOwner.cookie;

  process.stdout.write('EDGE_STAGE snapshot-and-split\n');
  const snapshotCategory = await createCategory('Snapshot Eski Kategori', 2);
  const snapshotProduct = await createProduct(
    snapshotCategory.id,
    'Snapshot Eski Ürün',
    10_000,
    'BAR',
    2,
  );
  const group = (
    await ownerA.request(
      'POST',
      `/api/menu/products/${snapshotProduct.id}/option-groups`,
      {
        name: 'Eski Grup',
        selectionType: 'SINGLE',
        isRequired: true,
        sortOrder: 1,
        isActive: true,
      },
      201,
    )
  ).optionGroup;
  const optionA = (
    await ownerA.request(
      'POST',
      `/api/menu/option-groups/${group.id}/values`,
      { name: 'Eski Seçenek A', priceDeltaKurus: 100, sortOrder: 1, isActive: true },
      201,
    )
  ).optionValue;
  const optionB = (
    await ownerA.request(
      'POST',
      `/api/menu/option-groups/${group.id}/values`,
      { name: 'Eski Seçenek B', priceDeltaKurus: 200, sortOrder: 2, isActive: true },
      201,
    )
  ).optionValue;
  const snapshotCheck = await open(tables[2].id);
  await ownerA.request(
    'POST',
    `/api/orders/checks/${snapshotCheck.id}/items`,
    { productId: snapshotProduct.id, quantity: 1, note: 'Snapshot notu', optionValueIds: [] },
    400,
  );
  await ownerA.request(
    'POST',
    `/api/orders/checks/${snapshotCheck.id}/items`,
    {
      productId: snapshotProduct.id,
      quantity: 1,
      note: null,
      optionValueIds: [optionA.id, optionB.id],
    },
    400,
  );
  const snapshotAdded = await add(snapshotCheck.id, snapshotProduct.id, [optionA.id]);
  const snapshotItem = snapshotAdded.items[0];
  await ownerA.request('PATCH', `/api/menu/categories/${snapshotCategory.id}`, {
    name: 'Snapshot Yeni Kategori',
    sortOrder: 2,
    isActive: true,
  });
  await ownerA.request('PATCH', `/api/menu/products/${snapshotProduct.id}`, {
    categoryId: snapshotCategory.id,
    name: 'Snapshot Yeni Ürün',
    priceKurus: 20_000,
    preparationArea: 'KITCHEN',
    sortOrder: 2,
    isActive: true,
  });
  await ownerA.request('PATCH', `/api/menu/option-groups/${group.id}`, {
    name: 'Yeni Grup',
    selectionType: 'SINGLE',
    isRequired: true,
    sortOrder: 1,
    isActive: true,
  });
  await ownerA.request('PATCH', `/api/menu/option-values/${optionA.id}`, {
    name: 'Yeni Seçenek',
    priceDeltaKurus: 9_000,
    sortOrder: 1,
    isActive: true,
  });
  const snapshotRead = (await ownerA.request('GET', `/api/orders/checks/${snapshotCheck.id}`)).check
    .items[0];
  assert.deepEqual(
    {
      product: snapshotRead.productNameSnapshot,
      category: snapshotRead.categoryNameSnapshot,
      price: snapshotRead.unitPriceKurusSnapshot,
      preparation: snapshotRead.preparationAreaSnapshot,
      group: snapshotRead.options[0].groupNameSnapshot,
      option: snapshotRead.options[0].valueNameSnapshot,
      delta: snapshotRead.options[0].priceDeltaKurusSnapshot,
    },
    {
      product: 'Snapshot Eski Ürün',
      category: 'Snapshot Eski Kategori',
      price: 10_000,
      preparation: 'BAR',
      group: 'Eski Grup',
      option: 'Eski Seçenek A',
      delta: 100,
    },
  );
  assert.equal(snapshotItem.lineTotalKurus, 10_100);
  const guestSplit = (
    await ownerA.request('POST', `/api/orders/checks/${snapshotCheck.id}/payment-split`, {
      mode: 'GUESTS',
    })
  ).split;
  assert.deepEqual(
    guestSplit.shares.map((share) => share.amountKurus),
    [3_367, 3_367, 3_366],
  );
  const itemSplit = (
    await ownerA.request('POST', `/api/orders/checks/${snapshotCheck.id}/payment-split`, {
      mode: 'ITEMS',
      itemIds: [snapshotItem.id],
    })
  ).split;
  assert.equal(itemSplit.totalKurus, 10_100);
  const amountSplit = (
    await ownerA.request('POST', `/api/orders/checks/${snapshotCheck.id}/payment-split`, {
      mode: 'AMOUNT',
      amountKurus: 5_000,
    })
  ).split;
  assert.equal(amountSplit.shares[0].amountKurus, 5_000);

  process.stdout.write('EDGE_STAGE large-fixture\n');
  const categories = [category, snapshotCategory];
  for (let index = 3; index <= 15; index += 1) {
    categories.push(await createCategory(`Büyük Kategori ${index}`, index));
  }
  const products = [product, snapshotProduct];
  for (let index = 3; index <= 100; index += 1) {
    products.push(
      await createProduct(
        categories[index % categories.length].id,
        `Büyük Ürün ${index}`,
        100,
        index % 2 === 0 ? 'BAR' : 'KITCHEN',
        index,
      ),
    );
  }
  for (let index = 1; index <= 30; index += 1) {
    await ownerA.request(
      'POST',
      `/api/menu/products/${products[index].id}/option-groups`,
      {
        name: `Büyük Grup ${index}`,
        selectionType: 'MULTIPLE',
        isRequired: false,
        sortOrder: index,
        isActive: true,
      },
      201,
    );
  }
  for (let index = 1; index <= 100; index += 1) {
    await ownerA.request(
      'POST',
      '/api/accounts',
      {
        name: `Büyük Müşteri ${String(index).padStart(3, '0')}`,
        phone: null,
        note: null,
        isActive: true,
      },
      201,
    );
  }
  const fixtureStart = performance.now();
  for (let index = 0; index < 100; index += 1) {
    let check = await open(tables[3 + (index % 37)].id, 1);
    for (let itemIndex = 0; itemIndex < 3; itemIndex += 1) {
      check = await add(check.id, products[2].id);
    }
    await ownerA.request(
      'POST',
      `/api/orders/checks/${check.id}/payments`,
      {
        method: 'CARD',
        amountKurus: 300,
        cashReceivedKurus: null,
      },
      201,
    );
    await ownerA.request('POST', `/api/orders/checks/${check.id}/close`, {});
  }
  for (let index = 3; index < 28; index += 1) await open(tables[index].id, 1);
  const fixtureBuildMs = Math.round(performance.now() - fixtureStart);

  let queryCount = 0;
  const client = new PrismaClient({
    datasourceUrl: databaseUrl,
    log: [{ emit: 'event', level: 'query' }],
  });
  client.$on('query', () => {
    queryCount += 1;
  });
  const accountStore = createPrismaAccountStore(client);
  const accountStart = performance.now();
  const customerRows = await accountStore.listCustomers();
  const accountListMs = Math.round(performance.now() - accountStart);
  await client.$disconnect();
  assert.equal(customerRows.length, 100);
  assert.equal(queryCount, 2);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const counts = {
    areas: await prisma.diningArea.count(),
    tables: await prisma.cafeTable.count(),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    optionGroups: await prisma.productOptionGroup.count(),
    customers: await prisma.customer.count(),
    auditLogs: await prisma.auditLog.count(),
    paidChecks: await prisma.check.count({ where: { status: 'PAID' } }),
    openChecks: await prisma.check.count({ where: { status: 'OPEN' } }),
    orderItems: await prisma.orderItem.count(),
  };
  await prisma.$disconnect();
  assert.ok(counts.auditLogs >= 500);
  assert.ok(counts.paidChecks >= 100);
  assert.ok(counts.openChecks >= 25);
  assert.ok(counts.orderItems >= 300);

  const result = {
    concurrency: {
      sameTableStatuses: openResponses.map((response) => response.status).sort(),
      paymentStatuses: paymentResponses.map((response) => response.status).sort(),
      statusTransitionStatuses: statusResponses.map((response) => response.status).sort(),
      ownerDeactivationStatuses: ownerResponses.map((response) => response.status).sort(),
      paidKurusAfterRace: paymentCheck.paidKurus,
    },
    snapshot: 'passed',
    split: {
      guests: guestSplit.shares.map((share) => share.amountKurus),
      item: itemSplit.totalKurus,
      amount: amountSplit.shares[0].amountKurus,
    },
    largeFixture: { ...counts, fixtureBuildMs, accountListMs, accountListQueryCount: queryCount },
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'edge-uat-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
