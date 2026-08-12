import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { PERMISSIONS, USER_ROLES } from '@kafe/contracts';
import type { Env } from '../config/env';
import { ConflictError, NotFoundError } from '../errors/app-error';
import {
  IdentityService,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  normalizeNameKey,
} from './identity-service';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';
import {
  readCookie,
  requireAuth,
  requireAuthentication,
  requirePermission,
  validationDetails,
} from './http';
import { StoreError, type AppStore } from './store';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Kullanıcı adı en az 3 karakter olmalıdır.')
  .max(32, 'Kullanıcı adı en fazla 32 karakter olabilir.')
  .regex(
    /^[A-Za-z0-9._-]+$/,
    'Kullanıcı adı yalnız harf, rakam, nokta, alt çizgi ve tire içerebilir.',
  );
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`)
  .max(PASSWORD_MAX_LENGTH, `Şifre en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.`);
const fullNameSchema = z.string().trim().min(2).max(100);
const nameSchema = z.string().trim().min(1).max(100);
const uuidParamsSchema = z.object({ id: z.string().uuid('Geçerli bir UUID girin.') });
const includeInactiveSchema = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

function parse<Output, Input>(
  schema: z.ZodType<Output, z.ZodTypeDef, Input>,
  value: unknown,
): Output {
  const result = schema.safeParse(value);
  if (!result.success) throw validationDetails(result.error);
  return result.data;
}

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value === undefined || value.length === 0 ? null : value));
}

function authCookieOptions(env: Env) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_MS,
  };
}

async function callStore<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StoreError) {
      if (error.code === 'NOT_FOUND') throw new NotFoundError(error.message);
      throw new ConflictError(error.message);
    }
    throw error;
  }
}

export function createPhaseOneRouter(store: AppStore, env: Env): Router {
  const router = Router();
  const identity = new IdentityService(store);
  const authenticate = requireAuthentication(identity, SESSION_COOKIE_NAME);
  const ownerOnly = [authenticate, requirePermission(PERMISSIONS.MANAGE_STAFF)];

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
        },
      });
    },
  });

  router.get('/setup/status', async (_req, res) => {
    res.json({ initialized: await identity.setupStatus() });
  });

  router.post('/auth/login', loginLimiter, async (req, res) => {
    const body = parse(z.object({ username: usernameSchema, password: passwordSchema }), req.body);
    const result = await identity.login(body.username, body.password);
    res.cookie(SESSION_COOKIE_NAME, result.token, authCookieOptions(env));
    res.json({ user: result.user });
  });

  router.post('/auth/logout', async (req, res) => {
    await identity.logout(readCookie(req.headers.cookie, SESSION_COOKIE_NAME));
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      path: '/',
    });
    res.status(204).end();
  });

  router.get('/auth/me', authenticate, (req, res) => {
    res.json({ user: requireAuth(req).user });
  });

  router.patch('/auth/password', authenticate, async (req, res) => {
    const body = parse(
      z.object({ currentPassword: passwordSchema, newPassword: passwordSchema }),
      req.body,
    );
    await identity.changePassword(requireAuth(req), body.currentPassword, body.newPassword);
    res.status(204).end();
  });

  router.get('/staff', ...ownerOnly, async (_req, res) => {
    res.json({ staff: await store.listStaff() });
  });

  router.post('/staff', ...ownerOnly, async (req, res) => {
    const body = parse(
      z.object({
        fullName: fullNameSchema,
        username: usernameSchema,
        password: passwordSchema,
        role: z.enum(USER_ROLES),
      }),
      req.body,
    );
    const staff = await identity.createStaff({ actorUserId: requireAuth(req).user.id, ...body });
    res.status(201).json({ staff });
  });

  router.patch('/staff/:id', ...ownerOnly, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const body = parse(
      z.object({ fullName: fullNameSchema, role: z.enum(USER_ROLES), isActive: z.boolean() }),
      req.body,
    );
    const staff = await identity.updateStaff({
      actorUserId: requireAuth(req).user.id,
      targetUserId: id,
      ...body,
    });
    res.json({ staff });
  });

  router.post('/staff/:id/reset-password', ...ownerOnly, async (req, res) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const { password } = parse(z.object({ password: passwordSchema }), req.body);
    await identity.resetStaffPassword(requireAuth(req).user.id, id, password);
    res.status(204).end();
  });

  router.get('/business-settings', authenticate, async (_req, res) => {
    const settings = await store.getBusinessSettings();
    if (settings === null) throw new NotFoundError('İşletme bilgileri henüz oluşturulmadı.');
    res.json({ settings });
  });

  router.patch(
    '/business-settings',
    authenticate,
    requirePermission(PERMISSIONS.MANAGE_BUSINESS),
    async (req, res) => {
      const body = parse(
        z.object({
          businessName: z.string().trim().min(2).max(120),
          phone: optionalText(40),
          address: optionalText(500),
        }),
        req.body,
      );
      const settings = await store.updateBusinessSettings({
        actorUserId: requireAuth(req).user.id,
        ...body,
      });
      res.json({ settings });
    },
  );

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
