import type { PrismaClient } from '@prisma/client';
import type { AuditFilterInput, DateRangeInput, ReportStore } from './report-store';
import { buildDayEnd, buildSalesReport, sanitizeAuditMetadata } from './report-calculations';
import { CHECK_INCLUDE, toCheck } from './prisma-order-store';

export function createPrismaReportStore(client: PrismaClient): ReportStore {
  const checksForRange = async (range: DateRangeInput) => {
    const rows = await client.check.findMany({
      where: {
        OR: [
          { status: 'PAID', closedAt: { gte: range.from, lt: range.toExclusive } },
          { items: { some: { cancelledAt: { gte: range.from, lt: range.toExclusive } } } },
        ],
      },
      include: CHECK_INCLUDE,
    });
    return rows.map(toCheck);
  };
  const report = async (range: DateRangeInput) => {
    return buildSalesReport(range, await checksForRange(range));
  };
  return {
    getSalesReport: report,
    async getDayEnd(range) {
      const [sales, openCheckCount, entries] = await Promise.all([
        report(range),
        client.check.count({ where: { status: 'OPEN' } }),
        client.accountEntry.findMany({
          select: { customerId: true, type: true, amountKurus: true },
        }),
      ]);
      const customerBalances = new Map<string, number>();
      for (const entry of entries) {
        const signed =
          entry.type === 'DEBT' || entry.type === 'REFUND' ? entry.amountKurus : -entry.amountKurus;
        customerBalances.set(
          entry.customerId,
          (customerBalances.get(entry.customerId) ?? 0) + signed,
        );
      }
      const openAccountBalanceKurus = [...customerBalances.values()].reduce(
        (total, balance) => total + Math.max(0, balance),
        0,
      );
      return buildDayEnd(range, sales, openCheckCount, openAccountBalanceKurus);
    },
    async listAuditLogs(filter: AuditFilterInput) {
      const where = {
        createdAt: { gte: filter.from, lt: filter.toExclusive },
        ...(filter.actorUserId === undefined ? {} : { actorUserId: filter.actorUserId }),
        ...(filter.action === undefined ? {} : { action: filter.action }),
        ...(filter.entityType === undefined ? {} : { entityType: filter.entityType }),
      };
      const [rows, actions, entityTypes] = await Promise.all([
        client.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 250,
          include: { actor: { select: { fullName: true } } },
        }),
        client.auditLog.findMany({ distinct: ['action'], select: { action: true } }),
        client.auditLog.findMany({ distinct: ['entityType'], select: { entityType: true } }),
      ]);
      return {
        entries: rows.map((row) => ({
          id: row.id,
          actorUserId: row.actorUserId,
          actorName: row.actor.fullName,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          metadata: sanitizeAuditMetadata(row.metadata),
          createdAt: row.createdAt.toISOString(),
        })),
        actions: actions.map((row) => row.action).sort(),
        entityTypes: entityTypes.map((row) => row.entityType).sort(),
      };
    },
  };
}
