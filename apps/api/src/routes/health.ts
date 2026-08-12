import { Router } from 'express';
import type { HealthResponse } from '@kafe/contracts';
import type { Env } from '../config/env';
import type { DatabaseProbe } from '../lib/database';

export interface HealthRouterOptions {
  env: Env;
  database: DatabaseProbe;
}

/**
 * GET /api/health
 * Veritabanı erişilebilirse 200, erişilemezse 503 döner.
 * Her iki durumda da gövde aynı biçimdedir; istemci durumu okuyabilir.
 */
export function createHealthRouter({ env, database }: HealthRouterOptions): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const connected = await database.ping();

    const body: HealthResponse = {
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    };

    res.status(connected ? 200 : 503).json(body);
  });

  return router;
}
