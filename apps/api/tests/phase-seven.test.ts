import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { CheckResponse, UserRole } from '@kafe/contracts';
import { buildSalesReport, sanitizeAuditMetadata } from '../src/features/report-calculations';
import { hashPassword } from '../src/features/password';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'PhaseSeven12!';
let passwordHash = '';
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

const range = {
  from: new Date('2026-08-11T21:00:00.000Z'),
  toExclusive: new Date('2026-08-12T21:00:00.000Z'),
  fromDate: '2026-08-12',
  toDate: '2026-08-12',
};

function item(
  overrides: Partial<CheckResponse['items'][number]> = {},
): CheckResponse['items'][number] {
  return {
    id: crypto.randomUUID(),
    productId: 'product-1',
    productNameSnapshot: 'Latte',
    categoryIdSnapshot: 'category-1',
    categoryNameSnapshot: 'Kahveler',
    unitPriceKurusSnapshot: 10_000,
    preparationAreaSnapshot: 'BAR',
    preparationStatus: 'SERVED',
    quantity: 1,
    note: null,
    lineTotalKurus: 10_000,
    createdByUserId: 'user-1',
    createdByName: 'Ayşe',
    createdAt: '2026-08-12T09:00:00.000Z',
    cancelledAt: null,
    cancellationReason: null,
    cancelledByUserId: null,
    cancelledByName: null,
    complimentaryAt: null,
    complimentaryReason: null,
    complimentaryByUserId: null,
    complimentaryByName: null,
    options: [],
    ...overrides,
  };
}

function check(
  status: CheckResponse['status'],
  overrides: Partial<CheckResponse> = {},
): CheckResponse {
  return {
    id: crypto.randomUUID(),
    tableId: 'table-1',
    tableName: 'Masa 1',
    openedByUserId: 'user-1',
    openedByName: 'Ayşe',
    guestCount: 2,
    status,
    openedAt: '2026-08-12T08:00:00.000Z',
    totalKurus: 9_000,
    discountTotalKurus: 1_000,
    paidKurus: 9_000,
    remainingKurus: 0,
    closedAt: status === 'PAID' ? '2026-08-12T10:15:00.000Z' : null,
    closedByUserId: status === 'PAID' ? 'user-1' : null,
    closedByName: status === 'PAID' ? 'Ayşe' : null,
    payments:
      status === 'PAID'
        ? [
            {
              id: crypto.randomUUID(),
              method: 'CASH',
              amountKurus: 9_000,
              receivedByUserId: 'user-1',
              receivedByName: 'Ayşe',
              createdAt: '2026-08-12T10:00:00.000Z',
            },
          ]
        : [],
    discounts: [],
    mergedIntoCheckId: null,
    items: [item()],
    ...overrides,
  };
}

async function session(role: UserRole) {
  const store = new MemoryStore();
  store.seedUser({ fullName: role, username: role.toLowerCase(), passwordHash, role });
  const app = createTestApp({ databaseConnected: true, store });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: role.toLowerCase(), password: PASSWORD });
  return { store, app, cookie: String(login.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '' };
}

describe('Phase 7 raporlar ve işlem geçmişi', () => {
  it('ciro, ortalama, ödeme, ürün, kategori, personel ve saat dağılımını backendde hesaplar', () => {
    const report = buildSalesReport(range, [check('PAID')]);
    expect(report).toMatchObject({
      revenueKurus: 9_000,
      paidCheckCount: 1,
      averageCheckKurus: 9_000,
      discountTotalKurus: 1_000,
    });
    expect(report.paymentDistribution).toContainEqual({ method: 'CASH', amountKurus: 9_000 });
    expect(report.productSales[0]).toMatchObject({
      name: 'Latte',
      quantity: 1,
      totalKurus: 10_000,
    });
    expect(report.categorySales[0]?.name).toBe('Kahveler');
    expect(report.staffSales[0]?.name).toBe('Ayşe');
    expect(report.hourlySales[13]?.totalKurus).toBe(9_000);
  });

  it('nakit, kart ve cari ödemeleri ayırır; MERGED/CANCELLED kayıtları ciroya katmaz', () => {
    const mixed = check('PAID', {
      totalKurus: 10_000,
      discountTotalKurus: 0,
      payments: [
        {
          id: 'p1',
          method: 'CASH',
          amountKurus: 3_000,
          receivedByUserId: 'u',
          receivedByName: 'A',
          createdAt: '2026-08-12T10:00:00Z',
        },
        {
          id: 'p2',
          method: 'CARD',
          amountKurus: 2_000,
          receivedByUserId: 'u',
          receivedByName: 'A',
          createdAt: '2026-08-12T10:00:00Z',
        },
        {
          id: 'p3',
          method: 'ACCOUNT',
          amountKurus: 5_000,
          receivedByUserId: 'u',
          receivedByName: 'A',
          createdAt: '2026-08-12T10:00:00Z',
        },
      ],
    });
    const report = buildSalesReport(range, [mixed, check('MERGED'), check('CANCELLED')]);
    expect(report.revenueKurus).toBe(10_000);
    expect(report.paymentDistribution).toEqual([
      { method: 'CASH', amountKurus: 3_000 },
      { method: 'CARD', amountKurus: 2_000 },
      { method: 'ACCOUNT', amountKurus: 5_000 },
    ]);
  });

  it('ikram ve tarih aralığındaki iptal kalemlerini ayrı raporlar', () => {
    const report = buildSalesReport(range, [
      check('PAID', {
        totalKurus: 0,
        discountTotalKurus: 0,
        paidKurus: 0,
        payments: [],
        items: [item({ complimentaryAt: '2026-08-12T09:30:00Z' })],
      }),
      check('OPEN', { items: [item({ cancelledAt: '2026-08-12T11:00:00Z' })] }),
    ]);
    expect(report.complimentaryTotalKurus).toBe(10_000);
    expect(report.cancelledItemCount).toBe(1);
    expect(report.cancelledItemTotalKurus).toBe(10_000);
  });

  it('OWNER ve CASHIER raporu görür; WAITER raporu, CASHIER audit kaydını göremez', async () => {
    for (const role of ['OWNER', 'CASHIER'] as const) {
      const x = await session(role);
      expect(
        (
          await request(x.app)
            .get('/api/reports/sales?from=2026-08-12&to=2026-08-12')
            .set('Cookie', x.cookie)
        ).status,
      ).toBe(200);
    }
    const waiter = await session('WAITER');
    expect(
      (await request(waiter.app).get('/api/reports/sales').set('Cookie', waiter.cookie)).status,
    ).toBe(403);
    const cashier = await session('CASHIER');
    expect(
      (await request(cashier.app).get('/api/reports/audit').set('Cookie', cashier.cookie)).status,
    ).toBe(403);
  });

  it('audit tarih/personel/işlem/entity filtrelerini uygular ve secret metadata gizler', async () => {
    const x = await session('OWNER');
    const actor = (await x.store.listStaff())[0];
    if (actor === undefined) throw new Error('Personel yok.');
    x.store.audits.push({
      id: crypto.randomUUID(),
      actorUserId: actor.id,
      action: 'SAFE_ACTION',
      entityType: 'Check',
      entityId: 'check-1',
      metadata: { amountKurus: 100, passwordHash: 'gizli', token: 'gizli' },
      createdAt: '2026-08-12T10:00:00Z',
    });
    const response = await request(x.app)
      .get(
        `/api/reports/audit?from=2026-08-12&to=2026-08-12&actorUserId=${actor.id}&action=SAFE_ACTION&entityType=Check`,
      )
      .set('Cookie', x.cookie);
    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0].metadata).toEqual({ amountKurus: 100 });
  });

  it('geçersiz ve bir yıldan uzun tarih filtresini reddeder', async () => {
    const x = await session('OWNER');
    expect(
      (
        await request(x.app)
          .get('/api/reports/sales?from=2026-08-13&to=2026-08-12')
          .set('Cookie', x.cookie)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(x.app)
          .get('/api/reports/sales?from=2025-01-01&to=2026-08-12')
          .set('Cookie', x.cookie)
      ).status,
    ).toBe(400);
  });

  it('metadata güvenlik filtresi iç içe secret nesneleri yayınlamaz', () => {
    expect(
      sanitizeAuditMetadata({
        reason: 'Test',
        authorization: 'secret',
        nested: { token: 'secret' },
      }),
    ).toEqual({ reason: 'Test' });
  });
});
