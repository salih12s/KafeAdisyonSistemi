import type {
  CheckResponse,
  DayEndResponse,
  PaymentMethod,
  SalesReportResponse,
} from '@kafe/contracts';
import type { DateRangeInput } from './report-store';

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'ACCOUNT'];

function istanbulHour(value: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value)),
  );
}

function addNamed(
  target: Map<string, { id: string; name: string; quantity: number; totalKurus: number }>,
  id: string,
  name: string,
  quantity: number,
  totalKurus: number,
): void {
  const row = target.get(id) ?? { id, name, quantity: 0, totalKurus: 0 };
  row.quantity += quantity;
  row.totalKurus += totalKurus;
  target.set(id, row);
}

function sortedNamed(
  rows: Map<string, { id: string; name: string; quantity: number; totalKurus: number }>,
) {
  return [...rows.values()].sort(
    (left, right) =>
      right.totalKurus - left.totalKurus || left.name.localeCompare(right.name, 'tr'),
  );
}

export function buildSalesReport(
  range: DateRangeInput,
  checks: CheckResponse[],
): SalesReportResponse {
  const paid = checks.filter(
    (check) =>
      check.status === 'PAID' &&
      check.closedAt !== null &&
      new Date(check.closedAt) >= range.from &&
      new Date(check.closedAt) < range.toExclusive,
  );
  const productSales = new Map<
    string,
    { id: string; name: string; quantity: number; totalKurus: number }
  >();
  const categorySales = new Map<
    string,
    { id: string; name: string; quantity: number; totalKurus: number }
  >();
  const staffSales = new Map<
    string,
    { id: string; name: string; quantity: number; totalKurus: number }
  >();
  const payments = new Map(PAYMENT_METHODS.map((method) => [method, 0]));
  const hourly = new Map<number, number>();
  let revenueKurus = 0;
  let discountTotalKurus = 0;
  let complimentaryTotalKurus = 0;

  for (const check of paid) {
    revenueKurus += check.totalKurus;
    discountTotalKurus += check.discountTotalKurus;
    addNamed(staffSales, check.openedByUserId, check.openedByName, 1, check.totalKurus);
    for (const payment of check.payments) {
      payments.set(payment.method, (payments.get(payment.method) ?? 0) + payment.amountKurus);
    }
    if (check.closedAt !== null) {
      const hour = istanbulHour(check.closedAt);
      hourly.set(hour, (hourly.get(hour) ?? 0) + check.totalKurus);
    }
    for (const item of check.items) {
      if (item.cancelledAt !== null) continue;
      if (item.complimentaryAt !== null) {
        complimentaryTotalKurus += item.lineTotalKurus;
        continue;
      }
      addNamed(
        productSales,
        item.productId,
        item.productNameSnapshot,
        item.quantity,
        item.lineTotalKurus,
      );
      addNamed(
        categorySales,
        item.categoryIdSnapshot,
        item.categoryNameSnapshot,
        item.quantity,
        item.lineTotalKurus,
      );
    }
  }

  const cancelled = checks
    .flatMap((check) => check.items)
    .filter(
      (item) =>
        item.cancelledAt !== null &&
        new Date(item.cancelledAt) >= range.from &&
        new Date(item.cancelledAt) < range.toExclusive,
    );
  return {
    range: { from: range.fromDate, to: range.toDate },
    revenueKurus,
    paidCheckCount: paid.length,
    averageCheckKurus: paid.length === 0 ? 0 : Math.round(revenueKurus / paid.length),
    paymentDistribution: PAYMENT_METHODS.map((method) => ({
      method,
      amountKurus: payments.get(method) ?? 0,
    })),
    productSales: sortedNamed(productSales),
    categorySales: sortedNamed(categorySales),
    staffSales: sortedNamed(staffSales),
    discountTotalKurus,
    complimentaryTotalKurus,
    cancelledItemCount: cancelled.length,
    cancelledItemTotalKurus: cancelled.reduce((total, item) => total + item.lineTotalKurus, 0),
    hourlySales: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      totalKurus: hourly.get(hour) ?? 0,
    })),
  };
}

export function buildDayEnd(
  range: DateRangeInput,
  report: SalesReportResponse,
  openCheckCount: number,
  openAccountBalanceKurus: number,
): DayEndResponse {
  const payment = new Map(report.paymentDistribution.map((row) => [row.method, row.amountKurus]));
  return {
    date: range.fromDate,
    revenueKurus: report.revenueKurus,
    cashKurus: payment.get('CASH') ?? 0,
    cardKurus: payment.get('CARD') ?? 0,
    accountKurus: payment.get('ACCOUNT') ?? 0,
    openCheckCount,
    openAccountBalanceKurus,
    discountTotalKurus: report.discountTotalKurus,
    complimentaryTotalKurus: report.complimentaryTotalKurus,
  };
}

const SECRET_KEY = /(password|token|hash|secret|cookie|authorization|database.?url)/i;

export function sanitizeAuditMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    if (Array.isArray(item)) {
      output[key] = item.filter(
        (entry): entry is string | number | boolean | null =>
          entry === null || ['string', 'number', 'boolean'].includes(typeof entry),
      );
    } else if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
      output[key] = item;
    }
  }
  return output;
}
