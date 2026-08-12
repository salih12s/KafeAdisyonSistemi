import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { io } from 'socket.io-client';

const baseUrl = process.env.UAT_BASE_URL ?? 'http://127.0.0.1:3100';
const ownerPassword = process.env.UAT_OWNER_PASSWORD;
const staffPassword = process.env.UAT_STAFF_PASSWORD;
const outputDirectory = process.env.UAT_OUTPUT_DIR;

if (!ownerPassword || !staffPassword || !outputDirectory) {
  throw new Error('UAT_OWNER_PASSWORD, UAT_STAFF_PASSWORD ve UAT_OUTPUT_DIR zorunludur.');
}

class Session {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.cookie = '';
    this.setCookie = '';
  }

  async request(method, pathname, body, expectedStatus = 200) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    assert.equal(
      response.status,
      expectedStatus,
      `${method} ${pathname}: ${response.status} ${text}`,
    );
    return { payload, headers: response.headers };
  }

  async login() {
    const { payload, headers } = await this.request(
      'POST',
      '/api/auth/login',
      { username: this.username, password: this.password },
      200,
    );
    this.setCookie = headers.get('set-cookie') ?? '';
    this.cookie = this.setCookie.split(';', 1)[0] ?? '';
    assert.match(this.cookie, /^kafe_session=/);
    return payload.user;
  }
}

const owner = new Session('uat_owner', ownerPassword);
const waiter = new Session('uat_waiter', staffPassword);
const kitchen = new Session('uat_kitchen', staffPassword);
const cashier = new Session('uat_cashier', staffPassword);
const anonymous = new Session('', '');
const events = { owner: [], waiter: [], kitchen: [] };

function assertMoney(check, expectedTotal, expectedPaid, expectedRemaining) {
  assert.equal(check.totalKurus, expectedTotal);
  assert.equal(check.paidKurus, expectedPaid);
  assert.equal(check.remainingKurus, expectedRemaining);
}

async function createStaff(fullName, username, role) {
  const { payload } = await owner.request(
    'POST',
    '/api/staff',
    { fullName, username, password: staffPassword, role },
    201,
  );
  return payload.staff;
}

async function createArea(name, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    '/api/areas',
    { name, sortOrder, isActive: true },
    201,
  );
  return payload.area;
}

async function createTable(areaId, name, capacity, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    '/api/tables',
    { areaId, name, capacity, sortOrder, isActive: true },
    201,
  );
  return payload.table;
}

async function createCategory(name, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    '/api/menu/categories',
    { name, sortOrder, isActive: true },
    201,
  );
  return payload.category;
}

async function createProduct(categoryId, name, priceKurus, preparationArea, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    '/api/menu/products',
    { categoryId, name, priceKurus, preparationArea, sortOrder, isActive: true },
    201,
  );
  return payload.product;
}

async function createOptionGroup(productId, name, selectionType, isRequired, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    `/api/menu/products/${productId}/option-groups`,
    { name, selectionType, isRequired, sortOrder, isActive: true },
    201,
  );
  return payload.optionGroup;
}

async function createOptionValue(groupId, name, priceDeltaKurus, sortOrder) {
  const { payload } = await owner.request(
    'POST',
    `/api/menu/option-groups/${groupId}/values`,
    { name, priceDeltaKurus, sortOrder, isActive: true },
    201,
  );
  return payload.optionValue;
}

async function openCheck(session, tableId, guestCount) {
  const { payload } = await session.request(
    'POST',
    '/api/orders/checks',
    { tableId, guestCount },
    201,
  );
  return payload.check;
}

async function addItem(session, checkId, productId, optionValueIds = [], note = null) {
  const { payload } = await session.request(
    'POST',
    `/api/orders/checks/${checkId}/items`,
    { productId, quantity: 1, note, optionValueIds },
    201,
  );
  return payload.check;
}

async function connectSocket(session, bucket) {
  const socket = io(baseUrl, {
    transports: ['websocket'],
    extraHeaders: { cookie: session.cookie },
    forceNew: true,
    reconnection: false,
  });
  socket.on('orders:changed', (event) => bucket.push(event));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket bağlantı zaman aşımı.')), 5_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', reject);
  });
  return socket;
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function main() {
  process.stdout.write('UAT_STAGE authentication\n');
  await anonymous.request('GET', '/api/auth/me', undefined, 401);
  const ownerUser = await owner.login();
  assert.equal(ownerUser.role, 'OWNER');
  assert.match(owner.setCookie, /HttpOnly/i);
  assert.match(owner.setCookie, /SameSite=Strict/i);
  assert.doesNotMatch(owner.setCookie, /Secure/i);

  await createStaff('UAT Garson', 'uat_waiter', 'WAITER');
  await createStaff('UAT Mutfak', 'uat_kitchen', 'KITCHEN');
  await createStaff('UAT Kasiyer', 'uat_cashier', 'CASHIER');
  await waiter.login();
  await kitchen.login();
  await cashier.login();

  await waiter.request('GET', '/api/reports/sales', undefined, 403);
  await waiter.request(
    'POST',
    '/api/menu/categories',
    { name: 'Yetkisiz', sortOrder: 0, isActive: true },
    403,
  );
  await kitchen.request(
    'POST',
    '/api/orders/checks',
    { tableId: '00000000-0000-4000-8000-000000000001', guestCount: 1 },
    403,
  );
  await cashier.request('GET', '/api/reports/sales', undefined, 200);
  await cashier.request('GET', '/api/reports/audit', undefined, 403);

  process.stdout.write('UAT_STAGE floor-plan\n');
  const inside = await createArea('İç Salon', 1);
  const garden = await createArea('Bahçe', 2);
  const terrace = await createArea('Teras', 3);
  await owner.request(
    'POST',
    '/api/areas',
    { name: 'İÇ SALON', sortOrder: 99, isActive: true },
    409,
  );
  const inactiveArea = await createArea('Pasif UAT Alanı', 99);
  await owner.request(
    'PATCH',
    `/api/areas/${inactiveArea.id}`,
    { name: inactiveArea.name, sortOrder: 99, isActive: false },
    200,
  );

  const tableDefinitions = [
    [inside, 'Masa 1', 2],
    [inside, 'Masa 2', 2],
    [inside, 'Masa 3', 4],
    [inside, 'Masa 4', 4],
    [inside, 'Masa 5', 6],
    [inside, 'Masa 6', 6],
    [garden, 'Masa 7', 2],
    [garden, 'Masa 8', 4],
    [garden, 'Masa 9', 4],
    [garden, 'Masa 10', 6],
    [terrace, 'Masa 11', 2],
    [terrace, 'Masa 12', 4],
  ];
  const tables = new Map();
  for (const [index, [area, name, capacity]] of tableDefinitions.entries()) {
    tables.set(name, await createTable(area.id, name, capacity, index + 1));
  }
  await owner.request(
    'POST',
    '/api/tables',
    { areaId: inside.id, name: 'MASA 1', capacity: 2, sortOrder: 50, isActive: true },
    409,
  );
  await createTable(garden.id, 'Masa 1', 2, 50);
  await owner.request(
    'POST',
    '/api/tables',
    { areaId: inside.id, name: 'Geçersiz', capacity: 0, sortOrder: 50, isActive: true },
    400,
  );

  process.stdout.write('UAT_STAGE menu\n');
  const categories = new Map();
  for (const [index, name] of [
    'Kahveler',
    'Soğuk İçecekler',
    'Tatlılar',
    'Atıştırmalıklar',
  ].entries()) {
    categories.set(name, await createCategory(name, index + 1));
  }
  await owner.request(
    'POST',
    '/api/menu/categories',
    { name: 'KAHVELER', sortOrder: 9, isActive: true },
    409,
  );
  await owner.request(
    'POST',
    '/api/menu/products',
    {
      categoryId: categories.get('Kahveler').id,
      name: 'Negatif',
      priceKurus: -1,
      preparationArea: 'BAR',
      sortOrder: 99,
      isActive: true,
    },
    400,
  );

  const products = new Map();
  const productDefinitions = [
    ['Kahveler', 'Espresso', 8_000, 'BAR'],
    ['Kahveler', 'Americano', 10_000, 'BAR'],
    ['Kahveler', 'Latte', 12_000, 'BAR'],
    ['Kahveler', 'Cappuccino', 12_000, 'BAR'],
    ['Soğuk İçecekler', 'Cold Brew', 14_000, 'BAR'],
    ['Soğuk İçecekler', 'Limonata', 11_000, 'BAR'],
    ['Tatlılar', 'San Sebastian', 19_000, 'KITCHEN'],
    ['Atıştırmalıklar', 'Kruvasan', 11_000, 'KITCHEN'],
    ['Atıştırmalıklar', 'Kaşarlı Tost', 17_000, 'KITCHEN'],
  ];
  for (const [index, [categoryName, name, price, area]] of productDefinitions.entries()) {
    products.set(
      name,
      await createProduct(categories.get(categoryName).id, name, price, area, index + 1),
    );
  }
  await owner.request(
    'POST',
    '/api/menu/products',
    {
      categoryId: categories.get('Kahveler').id,
      name: 'LATTE',
      priceKurus: 12_000,
      preparationArea: 'BAR',
      sortOrder: 99,
      isActive: true,
    },
    409,
  );

  const size = await createOptionGroup(products.get('Latte').id, 'Boyut', 'SINGLE', true, 1);
  const milk = await createOptionGroup(products.get('Latte').id, 'Süt Seçimi', 'SINGLE', true, 2);
  const extras = await createOptionGroup(
    products.get('Latte').id,
    'Ekstralar',
    'MULTIPLE',
    false,
    3,
  );
  const options = new Map();
  for (const [group, name, delta, order] of [
    [size, 'Küçük', 0, 1],
    [size, 'Orta', 1_500, 2],
    [size, 'Büyük', 3_000, 3],
    [milk, 'Normal süt', 0, 1],
    [milk, 'Laktozsuz süt', 1_500, 2],
    [milk, 'Yulaf sütü', 2_500, 3],
    [extras, 'Ekstra shot', 2_500, 1],
    [extras, 'Karamel şurubu', 1_500, 2],
  ]) {
    options.set(name, await createOptionValue(group.id, name, delta, order));
  }
  await createOptionValue(extras.id, 'UAT negatif fark', -500, 99);

  process.stdout.write('UAT_STAGE sockets\n');
  const ownerSocket = await connectSocket(owner, events.owner);
  const waiterSocket = await connectSocket(waiter, events.waiter);
  const kitchenSocket = await connectSocket(kitchen, events.kitchen);

  process.stdout.write('UAT_STAGE core-1\n');
  let first = await openCheck(waiter, tables.get('Masa 4').id, 3);
  await waiter.request(
    'POST',
    '/api/orders/checks',
    { tableId: tables.get('Masa 4').id, guestCount: 2 },
    409,
  );
  first = await addItem(waiter, first.id, products.get('Latte').id, [
    options.get('Büyük').id,
    options.get('Yulaf sütü').id,
    options.get('Ekstra shot').id,
  ]);
  assertMoney(first, 20_000, 0, 20_000);
  first = await addItem(waiter, first.id, products.get('Latte').id, [
    options.get('Orta').id,
    options.get('Normal süt').id,
  ]);
  first = await addItem(
    waiter,
    first.id,
    products.get('San Sebastian').id,
    [],
    'Kahvelerden sonra getir',
  );
  assertMoney(first, 52_500, 0, 52_500);
  assert.equal(first.openedByUserId, (await waiter.request('GET', '/api/auth/me')).payload.user.id);
  assert.equal(first.items[0].unitPriceKurusSnapshot, 12_000);
  assert.equal(first.items[0].lineTotalKurus, 20_000);
  assert.equal(first.items[2].note, 'Kahvelerden sonra getir');
  assert.equal(first.items[2].preparationAreaSnapshot, 'KITCHEN');

  await kitchen.request(
    'PATCH',
    `/api/orders/items/${first.items[0].id}/status`,
    { status: 'READY' },
    409,
  );
  for (const item of first.items) {
    for (const status of ['PREPARING', 'READY', 'SERVED']) {
      await kitchen.request('PATCH', `/api/orders/items/${item.id}/status`, { status }, 200);
    }
  }
  first = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${first.id}/discounts`,
      { type: 'FIXED', value: 2_500, reason: 'UAT kampanyası' },
      201,
    )
  ).payload.check;
  assertMoney(first, 50_000, 0, 50_000);

  const customer = (
    await cashier.request(
      'POST',
      '/api/accounts',
      {
        name: 'UAT Ahmet Yılmaz',
        phone: '05000000000',
        note: 'Final acceptance test müşterisi',
        isActive: true,
      },
      201,
    )
  ).payload.customer;
  first = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${first.id}/payments`,
      { method: 'CARD', amountKurus: 20_000, cashReceivedKurus: null },
      201,
    )
  ).payload.check;
  first = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${first.id}/payments`,
      { method: 'CASH', amountKurus: 20_000, cashReceivedKurus: 25_000 },
      201,
    )
  ).payload.check;
  first = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${first.id}/account-transfer`,
      { customerId: customer.id },
      200,
    )
  ).payload.check;
  assertMoney(first, 50_000, 50_000, 0);
  first = (await cashier.request('POST', `/api/orders/checks/${first.id}/close`, {}, 200)).payload
    .check;
  assert.equal(first.status, 'PAID');
  assert.equal(first.payments.find((payment) => payment.method === 'CASH').amountKurus, 20_000);
  await waiter.request(
    'POST',
    `/api/orders/checks/${first.id}/items`,
    { productId: products.get('Espresso').id, quantity: 1, note: null, optionValueIds: [] },
    409,
  );
  await cashier.request(
    'POST',
    `/api/orders/checks/${first.id}/payments`,
    { method: 'CARD', amountKurus: 1, cashReceivedKurus: null },
    409,
  );

  process.stdout.write('UAT_STAGE core-2\n');
  let toast = await openCheck(waiter, tables.get('Masa 7').id, 2);
  toast = await addItem(waiter, toast.id, products.get('Kaşarlı Tost').id);
  let espresso = await openCheck(waiter, tables.get('Masa 8').id, 2);
  espresso = await addItem(waiter, espresso.id, products.get('Espresso').id);
  espresso = await addItem(waiter, espresso.id, products.get('Espresso').id);
  assertMoney(toast, 17_000, 0, 17_000);
  assertMoney(espresso, 16_000, 0, 16_000);
  toast = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${toast.id}/move`,
      { targetTableId: tables.get('Masa 9').id },
      200,
    )
  ).payload.check;
  await cashier.request(
    'POST',
    `/api/orders/checks/${toast.id}/move`,
    { targetTableId: tables.get('Masa 8').id },
    409,
  );
  toast = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${toast.id}/merge`,
      { sourceCheckId: espresso.id },
      200,
    )
  ).payload.check;
  assertMoney(toast, 33_000, 0, 33_000);
  const mergedSource = (await owner.request('GET', `/api/orders/checks/${espresso.id}`)).payload
    .check;
  assert.equal(mergedSource.status, 'MERGED');
  const espressoItem = toast.items.find((item) => item.productNameSnapshot === 'Espresso');
  toast = (
    await cashier.request(
      'POST',
      `/api/orders/items/${espressoItem.id}/complimentary`,
      { reason: 'UAT müşteri memnuniyeti' },
      200,
    )
  ).payload.check;
  assertMoney(toast, 25_000, 0, 25_000);
  toast = (
    await cashier.request(
      'POST',
      `/api/orders/checks/${toast.id}/payments`,
      { method: 'CARD', amountKurus: 25_000, cashReceivedKurus: null },
      201,
    )
  ).payload.check;
  toast = (await cashier.request('POST', `/api/orders/checks/${toast.id}/close`, {}, 200)).payload
    .check;
  assert.equal(toast.status, 'PAID');

  process.stdout.write('UAT_STAGE oracle\n');
  const date = todayInIstanbul();
  const reportPath = `/api/reports/sales?from=${date}&to=${date}`;
  const dayEndPath = `/api/reports/day-end?from=${date}&to=${date}`;
  const report = (await owner.request('GET', reportPath)).payload.report;
  const dayEnd = (await owner.request('GET', dayEndPath)).payload.summary;
  const byMethod = Object.fromEntries(
    report.paymentDistribution.map((entry) => [entry.method, entry.amountKurus]),
  );
  const oracleBeforeCollection = {
    paidCheckCount: report.paidCheckCount,
    revenueKurus: report.revenueKurus,
    cardKurus: byMethod.CARD ?? 0,
    cashKurus: byMethod.CASH ?? 0,
    accountKurus: byMethod.ACCOUNT ?? 0,
    discountTotalKurus: report.discountTotalKurus,
    complimentaryTotalKurus: report.complimentaryTotalKurus,
    openAccountBalanceKurus: dayEnd.openAccountBalanceKurus,
  };
  assert.deepEqual(oracleBeforeCollection, {
    paidCheckCount: 2,
    revenueKurus: 75_000,
    cardKurus: 45_000,
    cashKurus: 20_000,
    accountKurus: 10_000,
    discountTotalKurus: 2_500,
    complimentaryTotalKurus: 8_000,
    openAccountBalanceKurus: 10_000,
  });

  const accountAfterCollection = (
    await cashier.request(
      'POST',
      `/api/accounts/${customer.id}/entries`,
      { type: 'COLLECTION', amountKurus: 4_000, description: 'UAT nakit tahsilat' },
      201,
    )
  ).payload.customer;
  assert.equal(accountAfterCollection.balanceKurus, 6_000);
  const reportAfterCollection = (await owner.request('GET', reportPath)).payload.report;
  assert.equal(reportAfterCollection.revenueKurus, 75_000);

  const audit = (await owner.request('GET', `/api/reports/audit?from=${date}&to=${date}`)).payload;
  const auditText = JSON.stringify(audit);
  for (const forbidden of [
    'passwordHash',
    'tokenHash',
    'DATABASE_URL',
    ownerPassword,
    staffPassword,
  ]) {
    assert.equal(auditText.includes(forbidden), false, `Audit secret içeriyor: ${forbidden}`);
  }
  assert.ok(audit.entries.length > 0);

  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.ok(events.owner.length > 0);
  assert.ok(events.waiter.length > 0);
  assert.ok(events.kitchen.length > 0);
  ownerSocket.disconnect();
  waiterSocket.disconnect();
  kitchenSocket.disconnect();

  const result = {
    database: 'isolated-uat',
    date,
    roleChecks: 'passed',
    cookieChecks: 'passed-development',
    realtime: {
      ownerEvents: events.owner.length,
      waiterEvents: events.waiter.length,
      kitchenEvents: events.kitchen.length,
    },
    oracleBeforeCollection,
    afterCollection: {
      balanceKurus: accountAfterCollection.balanceKurus,
      revenueKurus: reportAfterCollection.revenueKurus,
    },
    auditEntryCount: audit.entries.length,
  };
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, 'api-uat-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
