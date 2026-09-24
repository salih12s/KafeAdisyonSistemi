import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { CASH_MOVEMENT_TYPES, PERMISSIONS } from '@kafe/contracts';
import { callStore, parse, requireAuth, requirePermission } from './http';
import type { AppStore } from './store';

/** Bir kasa oturumunda makul üst sınır: 10 milyon TL. Hatalı giriş kalkanıdır. */
const MAX_CASH_KURUS = 1_000_000_000;
const kurus = z.number().int().min(0).max(MAX_CASH_KURUS);
const optionalNote = z
  .string()
  .trim()
  .max(250)
  .nullable()
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

export function createCashRouter(store: AppStore, authenticate: RequestHandler): Router {
  const router = Router();
  const canManage = [authenticate, requirePermission(PERMISSIONS.MANAGE_CASH)];

  router.get('/current', ...canManage, async (_req, res) => {
    res.json({ session: await store.getCurrentCashSession() });
  });

  router.get('/sessions', ...canManage, async (_req, res) => {
    res.json({ sessions: await store.listClosedCashSessions(30) });
  });

  router.post('/open', ...canManage, async (req, res) => {
    const body = parse(z.object({ openingCashKurus: kurus, note: optionalNote }), req.body);
    const session = await callStore(() =>
      store.openCashSession({ actorUserId: requireAuth(req).user.id, ...body }),
    );
    res.status(201).json({ session });
  });

  router.post('/current/movements', ...canManage, async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(CASH_MOVEMENT_TYPES),
        amountKurus: kurus.min(1, 'Tutar sıfırdan büyük olmalıdır.'),
        reason: z.string().trim().min(3, 'Açıklama en az 3 karakter olmalıdır.').max(250),
      }),
      req.body,
    );
    const session = await callStore(() =>
      store.addCashMovement({ actorUserId: requireAuth(req).user.id, ...body }),
    );
    res.status(201).json({ session });
  });

  router.post('/current/close', ...canManage, async (req, res) => {
    const body = parse(z.object({ countedCashKurus: kurus, note: optionalNote }), req.body);
    const session = await callStore(() =>
      store.closeCashSession({ actorUserId: requireAuth(req).user.id, ...body }),
    );
    res.json({ session });
  });

  return router;
}
