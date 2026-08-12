import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from './http';
import type { AppStore } from './store';

const uuidSchema = z.string().uuid('Geçerli bir UUID girin.');
const uuidParamsSchema = z.object({ id: uuidSchema });
const noteSchema = z
  .string()
  .trim()
  .max(500, 'Sipariş notu en fazla 500 karakter olabilir.')
  .nullable()
  .optional()
  .transform((value) =>
    value === undefined || value === null || value.length === 0 ? null : value,
  );

export function createOrderRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();
  const canView = [authenticate, requirePermission(PERMISSIONS.VIEW_ORDERS)];
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_ORDERS)];

  router.get('/floor-plan', ...canView, async (_req, res) => {
    res.json(await store.getOperationalFloorPlan());
  });

  router.post('/checks', ...canManage, async (req, res) => {
    const body = parse(
      z.object({ tableId: uuidSchema, guestCount: z.number().int().min(1).max(50) }),
      req.body,
    );
    const check = await callStore(() =>
      store.openCheck({ actorUserId: requireAuth(req).user.id, ...body }),
    );
    res.status(201).json({ check });
  });

  router.get('/checks/:id', ...canView, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    res.json({ check: await callStore(() => store.getCheck(id)) });
  });

  router.get('/tables/:id/open-check', ...canView, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    res.json({ check: await callStore(() => store.getOpenCheckByTable(id)) });
  });

  router.post('/checks/:id/items', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z.object({
        productId: uuidSchema,
        quantity: z.number().int().min(1).max(100),
        note: noteSchema,
        optionValueIds: z.array(uuidSchema).max(50).default([]),
      }),
      req.body,
    );
    const check = await callStore(() =>
      store.addOrderItem({
        actorUserId: requireAuth(req).user.id,
        checkId: id,
        ...body,
      }),
    );
    res.status(201).json({ check });
  });

  router.patch('/items/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z.object({ quantity: z.number().int().min(1).max(100), note: noteSchema }),
      req.body,
    );
    const check = await callStore(() =>
      store.updateOrderItem({
        actorUserId: requireAuth(req).user.id,
        itemId: id,
        ...body,
      }),
    );
    res.json({ check });
  });

  router.post('/items/:id/cancel', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { reason } = parse(
      z.object({
        reason: z.string().trim().min(3, 'İptal gerekçesi en az 3 karakter olmalıdır.').max(250),
      }),
      req.body,
    );
    const check = await callStore(() =>
      store.cancelOrderItem({ actorUserId: requireAuth(req).user.id, itemId: id, reason }),
    );
    res.json({ check });
  });

  return router;
}
