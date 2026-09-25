/** Satış raporu ve gün sonu uçları. */
import { type SalesReportResponse, type DayEndResponse } from '@kafe/contracts';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

function isNamedSales(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.totalKurus === 'number'
  );
}

function isSalesReport(value: unknown): value is SalesReportResponse {
  return (
    isRecord(value) &&
    isRecord(value.range) &&
    typeof value.range.from === 'string' &&
    typeof value.range.to === 'string' &&
    typeof value.revenueKurus === 'number' &&
    typeof value.paidCheckCount === 'number' &&
    typeof value.averageCheckKurus === 'number' &&
    Array.isArray(value.paymentDistribution) &&
    value.paymentDistribution.every(
      (row) =>
        isRecord(row) &&
        (row.method === 'CASH' || row.method === 'CARD' || row.method === 'ACCOUNT') &&
        typeof row.amountKurus === 'number',
    ) &&
    Array.isArray(value.productSales) &&
    value.productSales.every(isNamedSales) &&
    Array.isArray(value.categorySales) &&
    value.categorySales.every(isNamedSales) &&
    Array.isArray(value.staffSales) &&
    value.staffSales.every(isNamedSales) &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.complimentaryTotalKurus === 'number' &&
    typeof value.cancelledItemCount === 'number' &&
    typeof value.cancelledItemTotalKurus === 'number' &&
    Array.isArray(value.hourlySales) &&
    value.hourlySales.every(
      (row) => isRecord(row) && typeof row.hour === 'number' && typeof row.totalKurus === 'number',
    ) &&
    Array.isArray(value.dailySales) &&
    value.dailySales.every(
      (row) =>
        isRecord(row) &&
        typeof row.date === 'string' &&
        typeof row.totalKurus === 'number' &&
        typeof row.checkCount === 'number',
    )
  );
}

function queryDateRange(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function fetchSalesReport(from: string, to: string): Promise<SalesReportResponse> {
  const report = expectRecord(
    await requestPayload(`/api/reports/sales?${queryDateRange(from, to)}`),
    'report',
  );
  if (!isSalesReport(report)) throw new ApiError('Satış raporu okunamadı.');
  return report;
}

export async function fetchDayEnd(date: string): Promise<DayEndResponse> {
  const summary = expectRecord(
    await requestPayload(`/api/reports/day-end?${queryDateRange(date, date)}`),
    'summary',
  );
  if (!isDayEnd(summary)) {
    throw new ApiError('Gün sonu özeti okunamadı.');
  }
  return summary;
}

function isDayEnd(value: unknown): value is DayEndResponse {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.revenueKurus === 'number' &&
    typeof value.cashKurus === 'number' &&
    typeof value.cardKurus === 'number' &&
    typeof value.accountKurus === 'number' &&
    typeof value.openCheckCount === 'number' &&
    typeof value.openAccountBalanceKurus === 'number' &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.complimentaryTotalKurus === 'number'
  );
}
