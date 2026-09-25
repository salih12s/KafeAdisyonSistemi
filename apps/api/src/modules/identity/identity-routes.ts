import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { PERMISSIONS, USER_ROLES } from '@kafe/contracts';
import type { Env } from '../../config/env';
import { NotFoundError } from '../../errors/app-error';
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS, type IdentityService } from './identity-service';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';
import { parse, readCookie, requireAuth, requirePermission } from '../../shared/http';
import type { AppStore } from '../../shared/store';
import { uuidParamsSchema } from '../../shared/schemas';

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

function optionalText(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value === undefined || value.length === 0 ? null : value));
}

/**
 * Oturum çerezi her zaman HttpOnly'dir.
 *
 * Aynı origin kurulumunda `SameSite=Strict` kullanılır — en dar seçenek.
 * Arayüz ayrı bir origin'de barındırılıyorsa (`CORS_ORIGIN` dolu) tarayıcı
 * çerezi ancak `SameSite=None; Secure` ile gönderir; bu durumda `Secure`
 * zorunludur ve HTTPS gerektirir.
 */
function baseCookieOptions(env: Env) {
  const crossSite = env.CORS_ORIGIN.length > 0;
  return {
    httpOnly: true,
    sameSite: crossSite ? ('none' as const) : ('strict' as const),
    secure: crossSite || env.NODE_ENV === 'production',
    path: '/',
  };
}

function authCookieOptions(env: Env) {
  return { ...baseCookieOptions(env), maxAge: SESSION_DURATION_MS };
}

/** Kurulum durumu, oturum (giriş/çıkış/şifre), personel ve işletme ayarı uçları. */
export function createIdentityRouter(
  store: AppStore,
  env: Env,
  identity: IdentityService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
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
    res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions(env));
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

  return router;
}
