import { Router } from 'express';
import type { DatabaseProbe } from '../lib/database';
import { createHealthRouter } from './health';
import type { Env } from '../config/env';
import type { AppStore } from '../shared/store';
import { requireAuthentication } from '../shared/http';
import { IdentityService, SESSION_COOKIE_NAME } from '../modules/identity/identity-service';
import { createIdentityRouter } from '../modules/identity/identity-routes';
import { createFloorRouter } from '../modules/floor/floor-routes';
import { createMenuRouter } from '../modules/menu/menu-routes';
import { createOrderRouter } from '../modules/orders/order-routes';
import type { OrderEventPublisher } from '../modules/orders/order-events';
import { createAccountRouter } from '../modules/accounts/account-routes';
import { createReportRouter } from '../modules/reports/report-routes';
import { createCashRouter } from '../modules/cash/cash-routes';
import { createStockRouter } from '../modules/stock/stock-routes';
import { createPublicMenuRouter } from '../modules/public-menu/public-menu-routes';
import type { DemoMaintenance } from '../modules/demo/demo-maintenance';
import {
  createDemoInfoRouter,
  createDemoMaintenanceGate,
  createDemoRouter,
} from '../modules/demo/demo-routes';

export interface ApiRouterOptions {
  database: DatabaseProbe;
  env: Env;
  store?: AppStore;
  orderEvents?: OrderEventPublisher;
  /** Yalnız DEMO_MODE açıkken verilir (ADR-026). */
  demoMaintenance?: DemoMaintenance;
}

/**
 * /api altındaki tüm uçların tek toplanma noktası. Her modül kendi router'ını
 * sağlar; oturum doğrulayıcısı burada bir kez kurulur ve modüllere verilir.
 */
export function createApiRouter(options: ApiRouterOptions): Router {
  const router = Router();

  const { store, env, orderEvents, demoMaintenance } = options;

  // Sağlık isteği de bakımı dürter: zamanlanmış bir ping uyuyan süreci uyandırır.
  if (env.DEMO_MODE && demoMaintenance !== undefined) {
    router.use(createDemoMaintenanceGate(demoMaintenance));
  }
  router.use(createHealthRouter(options));
  router.use(createDemoInfoRouter(env, demoMaintenance));

  if (store === undefined) return router;

  const identity = new IdentityService(store);
  const authenticate = requireAuthentication(identity, SESSION_COOKIE_NAME);

  // Demo girişi ve demo hesap kilidi, kimlik uçlarından önce çalışmalıdır.
  if (env.DEMO_MODE) router.use(createDemoRouter(store, env, identity, authenticate));
  router.use(createIdentityRouter(store, env, identity, authenticate));
  router.use(createFloorRouter(store, authenticate));
  router.use('/menu', createMenuRouter(store, authenticate));
  router.use('/orders', createOrderRouter(store, authenticate, orderEvents));
  router.use('/accounts', createAccountRouter(store, authenticate, orderEvents));
  router.use('/reports', createReportRouter(store, authenticate));
  router.use('/cash', createCashRouter(store, authenticate));
  router.use('/stock', createStockRouter(store, authenticate));
  // Oturumsuz, yalnız okuma: QR menü.
  router.use('/public', createPublicMenuRouter(store));

  return router;
}
