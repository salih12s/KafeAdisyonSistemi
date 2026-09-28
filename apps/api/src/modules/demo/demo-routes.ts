import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  API_ERROR_CODES,
  DEMO_RESETTING_MESSAGE,
  USER_ROLES,
  type DemoInfoResponse,
} from '@kafe/contracts';
import type { Env } from '../../config/env';
import { ForbiddenError, NotFoundError } from '../../errors/app-error';
import { SESSION_COOKIE_NAME, type IdentityService } from '../identity/identity-service';
import { authCookieOptions } from '../identity/identity-routes';
import { parse, requireAuth } from '../../shared/http';
import type { AppStore } from '../../shared/store';
import { uuidParamsSchema } from '../../shared/schemas';
import type { DemoMaintenance } from './demo-maintenance';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './demo-seed';

const DEMO_USERNAMES = new Set(DEMO_ACCOUNTS.map((account) => account.username));
const LOCKED_MESSAGE =
  'Demo hesaplarının şifresi, rolü ve durumu değiştirilemez. Yeni bir personel ekleyip onu düzenleyebilirsiniz.';

/**
 * Demo modu kapalıyken yalnız `GET /demo` bulunur ve `enabled: false` döner;
 * arayüz buna bakarak "Demo ile gir" alanını gösterir ya da gizler.
 */
export function createDemoInfoRouter(env: Env, maintenance?: DemoMaintenance): Router {
  const router = Router();
  router.get('/demo', (_req, res) => {
    const body: DemoInfoResponse = env.DEMO_MODE
      ? { enabled: true, resetting: maintenance?.resetting ?? false, accounts: [...DEMO_ACCOUNTS] }
      : { enabled: false, resetting: false, accounts: [] };
    res.json(body);
  });
  return router;
}

/**
 * Her API isteğinde bakımı dürter; demo verisi yenilenirken sağlık ve demo
 * bilgisi dışındaki uçlar 503 döner (yarım veriyle işlem yapılmasın).
 */
export function createDemoMaintenanceGate(maintenance: DemoMaintenance): RequestHandler {
  return (req, res, next) => {
    maintenance.poke();
    if (maintenance.resetting && req.path !== '/demo' && !req.path.startsWith('/health')) {
      // Beklenen bir durum: hata günlüğüne düşmesin diye doğrudan yanıtlanır.
      res.status(503).json({
        error: { code: API_ERROR_CODES.SERVICE_UNAVAILABLE, message: DEMO_RESETTING_MESSAGE },
      });
      return;
    }
    next();
  };
}

/**
 * Demo girişi ve demo hesaplarının kilidi. Yalnız DEMO_MODE açıkken bağlanır ve
 * kimlik router'ından ÖNCE eklenir; kilit geçilirse istek oraya düşer.
 */
export function createDemoRouter(
  store: AppStore,
  env: Env,
  identity: IdentityService,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  // Şifresiz giriş olduğu için oturum tablosu şişirilmesin.
  const demoLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: API_ERROR_CODES.UNAUTHORIZED,
          message: 'Çok fazla demo girişi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.',
        },
      });
    },
  });

  // Yeni bir kimlik yolu açılmaz: sunucu normal girişi bilinen demo şifresiyle yapar.
  router.post('/auth/demo-login', demoLoginLimiter, async (req, res) => {
    const { role } = parse(z.object({ role: z.enum(USER_ROLES) }), req.body);
    const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === role);
    if (account === undefined) throw new NotFoundError('Bu rol için demo hesabı yok.');
    const result = await identity.login(account.username, DEMO_PASSWORD);
    res.cookie(SESSION_COOKIE_NAME, result.token, authCookieOptions(env));
    res.json({ user: result.user });
  });

  router.patch('/auth/password', authenticate, (req, _res, next) => {
    if (DEMO_USERNAMES.has(requireAuth(req).user.username)) {
      throw new ForbiddenError(LOCKED_MESSAGE);
    }
    next();
  });

  const protectDemoTarget: RequestHandler = async (req, _res, next) => {
    const { id } = parse(uuidParamsSchema, req.params);
    const target = (await store.listStaff()).find((member) => member.id === id);
    if (target !== undefined && DEMO_USERNAMES.has(target.username)) {
      throw new ForbiddenError(LOCKED_MESSAGE);
    }
    next();
  };
  router.patch('/staff/:id', authenticate, protectDemoTarget);
  router.post('/staff/:id/reset-password', authenticate, protectDemoTarget);

  return router;
}
