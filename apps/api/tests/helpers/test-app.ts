import type { Express } from 'express';
import { createApp } from '../../src/app';
import type { Env } from '../../src/config/env';
import type { DatabaseProbe } from '../../src/lib/database';
import { createSilentLogger } from '../../src/lib/logger';
import type { AppStore } from '../../src/shared/store';
import type { OrderEventPublisher } from '../../src/modules/orders/order-events';
import type { DemoMaintenance } from '../../src/modules/demo/demo-maintenance';

export const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3001,
  HOST: '127.0.0.1',
  DATABASE_URL: 'mysql://kafe:test@127.0.0.1:3306/kafe_adisyon',
  LOG_LEVEL: 'error',
  JSON_BODY_LIMIT: '1mb',
  CORS_ORIGIN: [],
  DEMO_MODE: false,
};

/** Canlı demo kurulumu (ADR-026): demo girişi ve demo hesap kilidi açıktır. */
export const demoEnv: Env = {
  ...testEnv,
  DATABASE_URL: 'mysql://kafe:test@127.0.0.1:3306/kafe_adisyon_demo',
  DEMO_MODE: true,
};

/** Arayüzün ayrı barındırıldığı kurulum: izinli origin listesiyle CORS açıktır. */
export function crossOriginEnv(origins: readonly string[]): Env {
  return { ...testEnv, CORS_ORIGIN: [...origins] };
}

/** Gerçek veritabanına dokunmadan, bağlantı durumu kontrol edilebilen sahte sonda. */
export function createStubProbe(connected: boolean): DatabaseProbe {
  return {
    ping: () => Promise.resolve(connected),
  };
}

export function createTestApp(options: {
  databaseConnected: boolean;
  store?: AppStore;
  env?: Env;
  orderEvents?: OrderEventPublisher;
  demoMaintenance?: DemoMaintenance;
  webDistPath?: string;
}): Express {
  return createApp({
    env: options.env ?? testEnv,
    logger: createSilentLogger(),
    database: createStubProbe(options.databaseConnected),
    ...(options.store === undefined ? {} : { store: options.store }),
    ...(options.orderEvents === undefined ? {} : { orderEvents: options.orderEvents }),
    ...(options.demoMaintenance === undefined ? {} : { demoMaintenance: options.demoMaintenance }),
    ...(options.webDistPath === undefined ? {} : { webDistPath: options.webDistPath }),
  });
}
