import type { Express } from 'express';
import { createApp } from '../../src/app';
import type { Env } from '../../src/config/env';
import type { DatabaseProbe } from '../../src/lib/database';
import { createSilentLogger } from '../../src/lib/logger';
import type { AppStore } from '../../src/features/store';
import type { OrderEventPublisher } from '../../src/features/order-events';

export const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3001,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://postgres:test@localhost:5432/CafeAdisyon?schema=public',
  LOG_LEVEL: 'error',
  JSON_BODY_LIMIT: '1mb',
};

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
}): Express {
  return createApp({
    env: options.env ?? testEnv,
    logger: createSilentLogger(),
    database: createStubProbe(options.databaseConnected),
    ...(options.store === undefined ? {} : { store: options.store }),
    ...(options.orderEvents === undefined ? {} : { orderEvents: options.orderEvents }),
  });
}
