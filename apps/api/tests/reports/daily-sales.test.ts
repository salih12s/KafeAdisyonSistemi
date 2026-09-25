import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildSalesReport } from '../../src/modules/reports/report-calculations';
import { fixture, sellAndClose } from '../helpers/operations-fixture';

describe('Günlük satış kırılımı', () => {
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
