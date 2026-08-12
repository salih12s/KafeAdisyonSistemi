import path from 'node:path';
import fs from 'node:fs';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_PREFIX } from '@kafe/contracts';
import type { Env } from './config/env';
import type { DatabaseProbe } from './lib/database';
import type { Logger } from './lib/logger';
import { createApiRouter } from './routes';
import { createCorsHandler } from './middleware/cors';
import { createErrorHandler } from './middleware/error-handler';
import { createNotFoundHandler } from './middleware/not-found';
import { createRequestLogger } from './middleware/request-logger';
import type { AppStore } from './features/store';
import type { OrderEventPublisher } from './features/order-events';

export interface CreateAppOptions {
  env: Env;
  logger: Logger;
  database: DatabaseProbe;
  store?: AppStore;
  orderEvents?: OrderEventPublisher;
  /** Üretimde sunulacak React derleme çıktısının klasörü. */
  webDistPath?: string;
}

/**
 * Express uygulamasını kurar ancak dinlemeye başlamaz.
 * Böylece testler gerçek bir port açmadan uygulamayı çalıştırabilir.
 */
export function createApp({
  env,
  logger,
  database,
  store,
  orderEvents,
  webDistPath,
}: CreateAppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  // Web ve API production'da aynı origin üzerinden sunulur; geliştirmede CSP kapalıdır.
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Arayüz ayrı barındırılıyorsa (CORS_ORIGIN dolu) izinli origin'lere CORS açılır.
  // Aynı origin kurulumunda bu katman hiç eklenmez.
  if (env.CORS_ORIGIN.length > 0) {
    app.use(createCorsHandler(env.CORS_ORIGIN));
  }

  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.JSON_BODY_LIMIT }));

  if (env.NODE_ENV === 'development') {
    app.use(createRequestLogger(logger));
  }

  app.use(
    API_PREFIX,
    createApiRouter({
      database,
      env,
      ...(store === undefined ? {} : { store }),
      ...(orderEvents === undefined ? {} : { orderEvents }),
    }),
  );

  // /api altındaki bilinmeyen uçlar her zaman JSON hata döner, HTML değil.
  app.use(API_PREFIX, createNotFoundHandler());

  const staticRoot = resolveWebDist(webDistPath, logger);

  if (staticRoot !== undefined) {
    app.use(express.static(staticRoot, { index: false, maxAge: '1h' }));
    app.use(createSpaFallback(path.join(staticRoot, 'index.html')));
  }

  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger, env.NODE_ENV !== 'production'));

  return app;
}

function resolveWebDist(webDistPath: string | undefined, logger: Logger): string | undefined {
  if (webDistPath === undefined) {
    return undefined;
  }

  if (!fs.existsSync(path.join(webDistPath, 'index.html'))) {
    logger.warn('Web derleme çıktısı bulunamadı, arayüz sunulmayacak.', { webDistPath });
    return undefined;
  }

  return webDistPath;
}

/**
 * React Router istemci tarafında çalıştığı için, bilinen olmayan GET yolları
 * index.html'e yönlendirilir. /api yolları buraya hiç ulaşmaz.
 */
function createSpaFallback(indexHtmlPath: string): express.RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    res.sendFile(indexHtmlPath, (error) => {
      if (error !== undefined && error !== null) {
        next(error);
      }
    });
  };
}
