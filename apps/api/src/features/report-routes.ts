import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@kafe/contracts';
import { callStore, parse, requirePermission } from './http';
import { StoreError, type AppStore } from './store';

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG biçiminde olmalıdır.');

function istanbulDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateRange(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00+03:00`);
  const toStart = new Date(`${toDate}T00:00:00+03:00`);
  const toExclusive = new Date(toStart.getTime() + 86_400_000);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(toStart.getTime()) ||
    istanbulDate(from) !== fromDate ||
    istanbulDate(toStart) !== toDate
  ) {
    throw new StoreError('VALIDATION', 'Geçersiz tarih.');
  }
  if (from > toStart) {
    throw new StoreError('VALIDATION', 'Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  }
  if (toExclusive.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new StoreError('VALIDATION', 'Tarih aralığı en fazla 366 gün olabilir.');
  }
  return { from, toExclusive, fromDate, toDate };
}

function parseRange(query: unknown) {
  const today = istanbulDate(new Date());
  const value = parse(
    z.object({ from: dateText.default(today), to: dateText.default(today) }),
    query,
  );
  return dateRange(value.from, value.to);
}

export function createReportRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();
  const reports = [authenticate, requirePermission(PERMISSIONS.VIEW_REPORTS)];
  const audit = [authenticate, requirePermission(PERMISSIONS.VIEW_AUDIT)];

  router.get('/sales', ...reports, async (req, res) => {
    const range = await callStore(() => Promise.resolve(parseRange(req.query)));
    res.json({ report: await store.getSalesReport(range) });
  });
  router.get('/day-end', ...reports, async (req, res) => {
    const range = await callStore(() => Promise.resolve(parseRange(req.query)));
    res.json({ summary: await store.getDayEnd(range) });
  });
  router.get('/audit', ...audit, async (req, res) => {
    const range = await callStore(() => Promise.resolve(parseRange(req.query)));
    const filter = parse(
      z.object({
        actorUserId: z.string().uuid().optional(),
        action: z.string().trim().min(1).max(100).optional(),
        entityType: z.string().trim().min(1).max(100).optional(),
      }),
      req.query,
    );
    res.json(await store.listAuditLogs({ ...range, ...filter }));
  });
  return router;
}
