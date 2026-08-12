import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { OPTION_SELECTION_TYPES, PERMISSIONS, PREPARATION_AREAS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from './http';
import { normalizeNameKey } from './identity-service';
import type { AppStore } from './store';

/**
 * Fiyat sınırları. Para birimi tam sayı kuruştur; ondalık kabul edilmez.
 * Üst sınır 1.000.000,00 TL — hatalı girişte sessizce absürt fiyat oluşmasını engeller.
 */
const MAX_PRICE_KURUS = 100_000_000;

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Ad boş olamaz.')
  .max(100, 'Ad en fazla 100 karakter olabilir.');

const sortOrderSchema = z.number().int().min(0).max(10_000);

const priceKurusSchema = z
  .number({ invalid_type_error: 'Fiyat kuruş cinsinden tam sayı olmalıdır.' })
  .int('Fiyat kuruş cinsinden tam sayı olmalıdır.')
  .min(0, 'Fiyat negatif olamaz.')
  .max(MAX_PRICE_KURUS, 'Fiyat izin verilen üst sınırı aşıyor.');

const priceDeltaSchema = z
  .number({ invalid_type_error: 'Fiyat farkı kuruş cinsinden tam sayı olmalıdır.' })
  .int('Fiyat farkı kuruş cinsinden tam sayı olmalıdır.')
  .min(-MAX_PRICE_KURUS, 'Fiyat farkı izin verilen alt sınırın altında.')
  .max(MAX_PRICE_KURUS, 'Fiyat farkı izin verilen üst sınırı aşıyor.');

const uuidParamsSchema = z.object({ id: z.string().uuid('Geçerli bir UUID girin.') });

const includeInactiveSchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const categoryBodySchema = z.object({
  name: nameSchema,
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

const productBodySchema = z.object({
  categoryId: z.string().uuid('Geçerli bir kategori seçin.'),
  name: nameSchema,
  priceKurus: priceKurusSchema,
  preparationArea: z.enum(PREPARATION_AREAS),
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

const optionGroupBodySchema = z.object({
  name: nameSchema,
  selectionType: z.enum(OPTION_SELECTION_TYPES),
  isRequired: z.boolean().default(false),
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

const optionValueBodySchema = z.object({
  name: nameSchema,
  priceDeltaKurus: priceDeltaSchema.default(0),
  sortOrder: sortOrderSchema.default(0),
  isActive: z.boolean().default(true),
});

/**
 * /api/menu altındaki uçlar.
 * Okuma VIEW_MENU, yazma MANAGE_MENU ister; yazma yetkisi yalnız OWNER rolündedir.
 * Hiçbir uç kayıt silmez — pasife alma `isActive` alanı ile yapılır.
 */
export function createMenuRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();
  const canView = [authenticate, requirePermission(PERMISSIONS.VIEW_MENU)];
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_MENU)];

  router.get('/', ...canView, async (_req, res) => {
    res.json(await store.getMenu());
  });

  router.get('/categories', ...canView, async (req, res) => {
    const query = parse(includeInactiveSchema, req.query);
    res.json({ categories: await store.listCategories(query.includeInactive) });
  });

  router.post('/categories', ...canManage, async (req, res) => {
    const body = parse(categoryBodySchema, req.body);
    const category = await callStore(() =>
      store.createCategory({
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.status(201).json({ category });
  });

  router.patch('/categories/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(categoryBodySchema, req.body);
    const category = await callStore(() =>
      store.updateCategory(id, {
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.json({ category });
  });

  router.get('/products', ...canView, async (req, res) => {
    const query = parse(
      includeInactiveSchema.extend({ categoryId: z.string().uuid().optional() }),
      req.query,
    );
    res.json({ products: await store.listProducts(query.categoryId, query.includeInactive) });
  });

  router.post('/products', ...canManage, async (req, res) => {
    const body = parse(productBodySchema, req.body);
    const product = await callStore(() =>
      store.createProduct({
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.status(201).json({ product });
  });

  router.patch('/products/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(productBodySchema, req.body);
    const product = await callStore(() =>
      store.updateProduct(id, {
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.json({ product });
  });

  router.get('/products/:id/option-groups', ...canView, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const query = parse(includeInactiveSchema, req.query);
    const groups = await callStore(() => store.listOptionGroups(id, query.includeInactive));
    res.json({ optionGroups: groups });
  });

  router.post('/products/:id/option-groups', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(optionGroupBodySchema, req.body);
    const optionGroup = await callStore(() =>
      store.createOptionGroup({
        actorUserId: requireAuth(req).user.id,
        productId: id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.status(201).json({ optionGroup });
  });

  router.patch('/option-groups/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(optionGroupBodySchema, req.body);
    const optionGroup = await callStore(() =>
      store.updateOptionGroup(id, {
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.json({ optionGroup });
  });

  router.post('/option-groups/:id/values', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(optionValueBodySchema, req.body);
    const optionValue = await callStore(() =>
      store.createOptionValue({
        actorUserId: requireAuth(req).user.id,
        groupId: id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.status(201).json({ optionValue });
  });

  router.patch('/option-values/:id', ...canManage, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(optionValueBodySchema, req.body);
    const optionValue = await callStore(() =>
      store.updateOptionValue(id, {
        actorUserId: requireAuth(req).user.id,
        ...body,
        nameKey: normalizeNameKey(body.name),
      }),
    );
    res.json({ optionValue });
  });

  return router;
}
