import type { AuditLogListResponse, DayEndResponse, SalesReportResponse } from '@kafe/contracts';

export interface DateRangeInput {
  from: Date;
  toExclusive: Date;
  fromDate: string;
  toDate: string;
}

export interface AuditFilterInput extends DateRangeInput {
  actorUserId?: string;
  action?: string;
  entityType?: string;
}

export interface ReportStore {
  getSalesReport(range: DateRangeInput): Promise<SalesReportResponse>;
  getDayEnd(range: DateRangeInput): Promise<DayEndResponse>;
  listAuditLogs(filter: AuditFilterInput): Promise<AuditLogListResponse>;
}
