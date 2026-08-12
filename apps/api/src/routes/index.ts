import { Router } from 'express';
import type { DatabaseProbe } from '../lib/database';
import { createHealthRouter } from './health';
import type { Env } from '../config/env';
import type { AppStore } from '../features/store';
import { createPhaseOneRouter } from '../features/routes';

export interface ApiRouterOptions {
  database: DatabaseProbe;
  env: Env;
  store?: AppStore;
}

/** /api altındaki tüm uçların tek toplanma noktası. */
export function createApiRouter(options: ApiRouterOptions): Router {
  const router = Router();

  router.use(createHealthRouter(options));

  if (options.store !== undefined) {
    router.use(createPhaseOneRouter(options.store, options.env));
  }

  return router;
}
