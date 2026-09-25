import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { PERMISSIONS, STOCK_UNITS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from '../../shared/http';
import { normalizeNameKey } from '../identity/identity-service';
import type { AppStore } from '../../shared/store';

/** En küçük birimde üst sınır: 10 ton / 10.000 litre / 10 milyon adet. */
const MAX_QUANTITY = 10_000_000;
/** Bir adet ürünün tüketebileceği en fazla miktar: 100 kg / 100 L / 100.000 adet. */
const MAX_RECIPE_QUANTITY = 100_000;
const quantity = z.number().int().min(1, 'Miktar sıfırdan büyük olmalıdır.').max(MAX_QUANTITY);
const uuidParams = z.object({ id: z.string().uuid('Geçerli bir UUID girin.') });
const reason = z
  .string()
  .trim()
  .max(250)
  .nullable()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));
const itemBody = z.object({
  name: z.string().trim().min(2).max(100),
  lowStockThreshold: z.number().int().min(0).max(MAX_QUANTITY),
  isActive: z.boolean().default(true),
});
const movementBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PURCHASE'), quantity, reason }),
  z.object({ type: z.literal('WASTE'), quantity, reason }),
  z.object({
    type: z.literal('ADJUSTMENT'),
    countedQuantity: z.number().int().min(0).max(MAX_QUANTITY),
    reason: z.string().trim().min(3, 'Sayım düzeltmesi için açıklama girin.').max(250),
  }),
]);
const recipeBody = z.object({
  lines: z
    .array(
      z.object({
        stockItemId: z.string().uuid(),
        quantityPerUnit: z.number().int().min(1).max(MAX_RECIPE_QUANTITY),
      }),
    )
    .max(30),
});

export function createStockRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();
  const canView = [authenticate, requirePermission(PERMISSIONS.VIEW_STOCK)];
  const canRecord = [authenticate, requirePermission(PERMISSIONS.RECORD_STOCK)];
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_STOCK)];

  router.get('/items', ...canView, async (req, res) => {
    const { includeInactive } = parse(
      z.object({ includeInactive: z.enum(['true', 'false']).optional() }),
      req.query,
    );
    res.json({ items: await store.listStockItems(includeInactive === 'true') });
  });

  router.get('/items/:id', ...canView, async (req, res) => {
    const { id } = parse(uuidParams, req.params);
    res.json({ item: await callStore(() => store.getStockItem(id)) });
  });

  router.post('/items', ...canManage, async (req, res) => {
    const body = parse(itemBody.extend({ unit: z.enum(STOCK_UNITS) }), req.body);
    const item = await callStore(() =>
      store.createStockItem({
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.status(201).json({ item });
  });

  router.patch('/items/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParams, req.params);
    const body = parse(itemBody, req.body);
    const item = await callStore(() =>
      store.updateStockItem(id, {
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.json({ item });
  });

  router.post('/items/:id/movements', ...canRecord, async (req, res) => {
    const { id } = parse(uuidParams, req.params);
    const body = parse(movementBody, req.body);
    const item = await callStore(() =>
      store.addStockMovement({ actorUserId: requireAuth(req).user.id, stockItemId: id, ...body }),
    );
    res.status(201).json({ item });
  });

  router.get('/recipes/:id', ...canView, async (req, res) => {
    const { id } = parse(uuidParams, req.params);
    res.json({ recipe: await callStore(() => store.getProductRecipe(id)) });
  });

  router.put('/recipes/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParams, req.params);
    const body = parse(recipeBody, req.body);
    const recipe = await callStore(() =>
      store.setProductRecipe({ actorUserId: requireAuth(req).user.id, productId: id, ...body }),
    );
    res.json({ recipe });
  });

  return router;
}
