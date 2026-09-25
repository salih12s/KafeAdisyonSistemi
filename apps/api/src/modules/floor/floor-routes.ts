import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from '../../shared/http';
import { includeInactiveSchema, nameSchema, uuidParamsSchema } from '../../shared/schemas';
import type { AppStore } from '../../shared/store';
import { normalizeNameKey } from '../identity/identity-service';

/** Salon (DiningArea), masa (CafeTable) ve yönetim masa planı uçları. */
export function createFloorRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();

  router.get('/areas', authenticate, async (req, res) => {
    const query = parse(includeInactiveSchema, req.query);
    res.json({ areas: await store.listAreas(query.includeInactive) });
  });

  router.post(
    '/areas',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_AREAS),
    async (req, res) => {
      const body = parse(
        z.object({
          name: nameSchema,
          sortOrder: z.number().int().min(0).max(10_000),
          isActive: z.boolean().default(true),
        }),
        req.body,
      );
      const area = await callStore(() =>
        store.createArea({
          actorUserId: requireAuth(req).user.id,
          ...body,
          nameKey: normalizeNameKey(body.name),
        }),
      );
      res.status(201).json({ area });
    },
  );

  router.patch(
    '/areas/:id',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_AREAS),
    async (req, res) => {
      const { id } = parse(uuidParamsSchema, req.params);
      const body = parse(
        z.object({
          name: nameSchema,
          sortOrder: z.number().int().min(0).max(10_000),
          isActive: z.boolean(),
        }),
        req.body,
      );
      const area = await callStore(() =>
        store.updateArea(id, {
          actorUserId: requireAuth(req).user.id,
          ...body,
          nameKey: normalizeNameKey(body.name),
        }),
      );
      res.json({ area });
    },
  );

  router.get('/tables', authenticate, async (req, res) => {
    const query = parse(
      includeInactiveSchema.extend({ areaId: z.string().uuid().optional() }),
      req.query,
    );
    res.json({ tables: await store.listTables(query.areaId, query.includeInactive) });
  });

  const tableBodySchema = z.object({
    areaId: z.string().uuid(),
    name: nameSchema,
    capacity: z.number().int().min(1).max(50).nullable().default(null),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean().default(true),
  });

  router.post(
    '/tables',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_TABLES),
    async (req, res) => {
      const body = parse(tableBodySchema, req.body);
      const table = await callStore(() =>
        store.createTable({
          actorUserId: requireAuth(req).user.id,
          ...body,
          nameKey: normalizeNameKey(body.name),
        }),
      );
      res.status(201).json({ table });
    },
  );

  router.patch(
    '/tables/:id',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_TABLES),
    async (req, res) => {
      const { id } = parse(uuidParamsSchema, req.params);
      const body = parse(tableBodySchema, req.body);
      const table = await callStore(() =>
        store.updateTable(id, {
          actorUserId: requireAuth(req).user.id,
          ...body,
          nameKey: normalizeNameKey(body.name),
        }),
      );
      res.json({ table });
    },
  );

  router.get(
    '/floor-plan',
    authenticate,
    requirePermission(PERMISSIONS.VIEW_TABLES),
    async (_req, res) => {
      res.json(await store.getFloorPlan());
    },
  );

  return router;
}
