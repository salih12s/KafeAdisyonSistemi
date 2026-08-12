import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ACCOUNT_ENTRY_TYPES, PERMISSIONS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from './http';
import { silentOrderEventPublisher, type OrderEventPublisher } from './order-events';
import type { AppStore } from './store';

const uuid = z.string().uuid();
const params = z.object({ id: uuid });
const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));
const customerBody = z.object({
  name: z.string().trim().min(2).max(150),
  phone: optionalText,
  note: optionalText,
  isActive: z.boolean().default(true),
});

export function createAccountRouter(
  store: AppStore,
  authenticate: RequestHandler,
  events: OrderEventPublisher = silentOrderEventPublisher,
): Router {
  const router = Router();
  const canView = [authenticate, requirePermission(PERMISSIONS.VIEW_ACCOUNTS)];
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_ACCOUNTS)];
  router.get('/', ...canView, async (req, res) => {
    const { search } = parse(
      z.object({ search: z.string().trim().max(100).optional() }),
      req.query,
    );
    res.json({ customers: await callStore(() => store.listCustomers(search)) });
  });
  router.get('/:id', ...canView, async (req, res) => {
    const { id } = parse(params, req.params);
    res.json({ customer: await callStore(() => store.getCustomer(id)) });
  });
  router.post('/', ...canManage, async (req, res) => {
    const body = parse(customerBody, req.body);
    const customer = await callStore(() =>
      store.createCustomer({ actorUserId: requireAuth(req).user.id, ...body }),
    );
    events.publish({ type: 'ACCOUNT_CHANGED', customerId: customer.id });
    res.status(201).json({ customer });
  });
  router.patch('/:id', ...canManage, async (req, res) => {
    const { id } = parse(params, req.params);
    const body = parse(customerBody, req.body);
    const customer = await callStore(() =>
      store.updateCustomer(id, { actorUserId: requireAuth(req).user.id, ...body }),
    );
    events.publish({ type: 'ACCOUNT_CHANGED', customerId: id });
    res.json({ customer });
  });
  router.post('/:id/entries', ...canManage, async (req, res) => {
    const { id } = parse(params, req.params);
    const body = parse(
      z.object({
        type: z.enum(ACCOUNT_ENTRY_TYPES).exclude(['DEBT']),
        amountKurus: z.number().int().min(1),
        description: z.string().trim().min(3).max(250),
      }),
      req.body,
    );
    const customer = await callStore(() =>
      store.addAccountEntry({ actorUserId: requireAuth(req).user.id, customerId: id, ...body }),
    );
    events.publish({ type: 'ACCOUNT_CHANGED', customerId: id });
    res.status(201).json({ customer });
  });
  return router;
}
