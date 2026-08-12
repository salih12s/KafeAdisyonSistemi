import { Router } from 'express';
import type { Env } from '../config/env';
import type { DatabaseProbe } from '../lib/database';
import { createHealthRouter } from './health';

export interface ApiRouterOptions {
  env: Env;
  database: DatabaseProbe;
}

/** /api altındaki tüm uçların tek toplanma noktası. */
export function createApiRouter(options: ApiRouterOptions): Router {
  const router = Router();

  router.use(createHealthRouter(options));

  return router;
}
