import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ORDER_ITEM_STATUSES, PERMISSIONS, PREPARATION_AREAS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from './http';
import { silentOrderEventPublisher, type OrderEventPublisher } from './order-events';
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

export function createOrderRouter(
  store: AppStore,
  authenticate: RequestHandler,
  events: OrderEventPublisher = silentOrderEventPublisher,
): Router {
  const router = Router();
  const canView = [authenticate, requirePermission(PERMISSIONS.VIEW_ORDERS)];
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_ORDERS)];
  const canAdjust = [authenticate, requirePermission(PERMISSIONS.ADJUST_CHECKS)];
  const canMove = [authenticate, requirePermission(PERMISSIONS.MOVE_TABLES)];
  const canMerge = [authenticate, requirePermission(PERMISSIONS.MERGE_TABLES)];

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

  router.post('/checks/:id/payments', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z
        .object({
          method: z.enum(['CASH', 'CARD']),
          amountKurus: z.number().int().min(1).max(2_147_483_647),
          cashReceivedKurus: z.number().int().min(1).max(2_147_483_647).nullable().default(null),
        })
        .superRefine((value, context) => {
          if (value.method === 'CARD' && value.cashReceivedKurus !== null) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['cashReceivedKurus'],
              message: 'Kart ödemesinde alınan nakit gönderilemez.',
            });
          }
        }),
      req.body,
    );
    const check = await callStore(() =>
      store.addPayment({
        actorUserId: requireAuth(req).user.id,
        checkId: id,
        ...body,
      }),
    );
    events.publish({ type: 'PAYMENT_ADDED', checkId: id });
    res.status(201).json({ check });
  });

  router.post('/checks/:id/payment-split', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z.discriminatedUnion('mode', [
        z.object({ mode: z.literal('AMOUNT'), amountKurus: z.number().int().min(1) }),
        z.object({ mode: z.literal('ITEMS'), itemIds: z.array(uuidSchema).min(1).max(100) }),
        z.object({ mode: z.literal('GUESTS') }),
      ]),
      req.body,
    );
    const split = await callStore(() =>
      store.previewPaymentSplit({
        actorUserId: requireAuth(req).user.id,
        checkId: id,
        ...body,
      }),
    );
    res.json({ split });
  });

  router.post('/checks/:id/close', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const check = await callStore(() =>
      store.closeCheck({ actorUserId: requireAuth(req).user.id, checkId: id }),
    );
    events.publish({ type: 'CHECK_CLOSED', checkId: id });
    res.json({ check });
  });

  router.post(
    '/checks/:id/account-transfer',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_ACCOUNTS),
    async (req, res) => {
      const { id } = parse(uuidParamsSchema, req.params);
      const { customerId } = parse(z.object({ customerId: uuidSchema }), req.body);
      const check = await callStore(() =>
        store.transferCheckToAccount({
          actorUserId: requireAuth(req).user.id,
          checkId: id,
          customerId,
        }),
      );
      events.publish({ type: 'ACCOUNT_CHANGED', customerId, checkId: id });
      res.json({ check });
    },
  );
  router.post('/checks/:id/discounts', ...canAdjust, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('PERCENT'),
          value: z.number().int().min(1).max(100),
          reason: z.string().trim().min(3).max(250),
        }),
        z.object({
          type: z.literal('FIXED'),
          value: z.number().int().min(1).max(2_147_483_647),
          reason: z.string().trim().min(3).max(250),
        }),
      ]),
      req.body,
    );
    const check = await callStore(() =>
      store.applyDiscount({ actorUserId: requireAuth(req).user.id, checkId: id, ...body }),
    );
    events.publish({ type: 'CHECK_ADJUSTED', checkId: id });
    res.status(201).json({ check });
  });
  router.post('/items/:id/complimentary', ...canAdjust, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(250) }), req.body);
    const check = await callStore(() =>
      store.makeOrderItemComplimentary({
        actorUserId: requireAuth(req).user.id,
        itemId: id,
        reason,
      }),
    );
    events.publish({ type: 'CHECK_ADJUSTED', checkId: check.id });
    res.json({ check });
  });
  router.post('/checks/:id/move', ...canMove, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { targetTableId } = parse(z.object({ targetTableId: uuidSchema }), req.body);
    const check = await callStore(() =>
      store.moveCheck({ actorUserId: requireAuth(req).user.id, checkId: id, targetTableId }),
    );
    events.publish({ type: 'TABLE_MOVED', checkId: id });
    res.json({ check });
  });
  router.post('/checks/:id/merge', ...canMerge, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { sourceCheckId } = parse(z.object({ sourceCheckId: uuidSchema }), req.body);
    const check = await callStore(() =>
      store.mergeChecks({
        actorUserId: requireAuth(req).user.id,
        targetCheckId: id,
        sourceCheckId,
      }),
    );
    events.publish({ type: 'CHECK_MERGED', checkId: id, sourceCheckId });
    res.json({ check });
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
    const item = check.items.at(-1);
    if (item !== undefined) {
      events.publish({
        type: 'ITEM_ADDED',
        checkId: check.id,
        itemId: item.id,
        preparationArea: item.preparationAreaSnapshot,
      });
    }
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
    const item = check.items.find((entry) => entry.id === id);
    if (item !== undefined) {
      events.publish({
        type: 'ITEM_UPDATED',
        checkId: check.id,
        itemId: item.id,
        preparationArea: item.preparationAreaSnapshot,
      });
    }
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
    const item = check.items.find((entry) => entry.id === id);
    if (item !== undefined) {
      events.publish({
        type: 'ITEM_CANCELLED',
        checkId: check.id,
        itemId: item.id,
        preparationArea: item.preparationAreaSnapshot,
      });
    }
    res.json({ check });
  });

  const canViewKitchen = [authenticate, requirePermission(PERMISSIONS.VIEW_KITCHEN)];
  const canManageKitchen = [authenticate, requirePermission(PERMISSIONS.MANAGE_KITCHEN)];

  router.get('/kitchen', ...canViewKitchen, async (req, res) => {
    const { preparationArea } = parse(
      z.object({ preparationArea: z.enum(PREPARATION_AREAS).optional() }),
      req.query,
    );
    res.json({ orders: await callStore(() => store.listKitchenOrders(preparationArea)) });
  });

  router.patch('/items/:id/status', ...canManageKitchen, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { status } = parse(z.object({ status: z.enum(ORDER_ITEM_STATUSES) }), req.body);
    const check = await callStore(() =>
      store.updateOrderItemStatus({
        actorUserId: requireAuth(req).user.id,
        itemId: id,
        status,
      }),
    );
    const item = check.items.find((entry) => entry.id === id);
    if (item !== undefined) {
      events.publish({
        type: 'ITEM_STATUS_CHANGED',
        checkId: check.id,
        itemId: item.id,
        preparationArea: item.preparationAreaSnapshot,
      });
    }
    res.json({ check });
  });

  return router;
}
