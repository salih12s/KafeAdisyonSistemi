import type { Kurus } from './money.js';
import type { PaymentMethod } from './orders.js';

export interface DateRangeResponse {
  from: string;
  to: string;
}

export interface NamedSalesTotal {
  id: string;
  name: string;
  quantity: number;
  totalKurus: Kurus;
}

export interface PaymentDistributionItem {
  method: PaymentMethod;
  amountKurus: Kurus;
}

export interface HourlySalesItem {
  hour: number;
  totalKurus: Kurus;
}

export interface SalesReportResponse {
  range: DateRangeResponse;
  revenueKurus: Kurus;
  paidCheckCount: number;
  averageCheckKurus: Kurus;
  paymentDistribution: PaymentDistributionItem[];
  productSales: NamedSalesTotal[];
  categorySales: NamedSalesTotal[];
  staffSales: NamedSalesTotal[];
  discountTotalKurus: Kurus;
  complimentaryTotalKurus: Kurus;
  cancelledItemCount: number;
  cancelledItemTotalKurus: Kurus;
  hourlySales: HourlySalesItem[];
}

export interface DayEndResponse {
  date: string;
  revenueKurus: Kurus;
  cashKurus: Kurus;
  cardKurus: Kurus;
  accountKurus: Kurus;
  openCheckCount: number;
  openAccountBalanceKurus: Kurus;
  discountTotalKurus: Kurus;
  complimentaryTotalKurus: Kurus;
}

export interface AuditLogResponse {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  entries: AuditLogResponse[];
  actions: string[];
  entityTypes: string[];
}
