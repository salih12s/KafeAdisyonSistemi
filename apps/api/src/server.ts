import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { createApp } from './app';
import { ENV_FILE_PATH, WEB_DIST_PATH } from './config/paths';
import { EnvValidationError, parseEnv, type Env } from './config/env';
import { createPrismaLifecycle } from './lib/database';
import { createLogger } from './lib/logger';
import { createPrismaStore } from './features/prisma-store';
import { createOrderEventHub } from './features/order-events';
import { createRealtimeServer } from './realtime';

dotenv.config({ path: ENV_FILE_PATH });

function loadEnv(): Env {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(
        [
          '',
          'Uygulama başlatılamadı: ortam değişkenleri eksik veya hatalı.',
          ...error.issues.map((issue) => `  - ${issue}`),
          '',
          `Çözüm: apps/api/.env.example dosyasını ${ENV_FILE_PATH} olarak kopyalayın ve doldurun.`,
          '',
        ].join('\n'),
      );
      process.exit(1);
    }

    throw error;
  }
}

function start(): void {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const database = createPrismaLifecycle(env.DATABASE_URL, logger);
  const store = createPrismaStore(database.client);
  const orderEvents = createOrderEventHub();

  const app = createApp({
    env,
    logger,
    database: database.probe,
    store,
    orderEvents,
    ...(env.NODE_ENV === 'production' ? { webDistPath: WEB_DIST_PATH } : {}),
  });

  const server = createServer(app);
  const realtime = createRealtimeServer(server, store, orderEvents, logger);

  server.listen(env.PORT, env.HOST, () => {
    logger.info('API sunucusu dinlemede.', {
      host: env.HOST,
      port: env.PORT,
      environment: env.NODE_ENV,
    });
    logger.info(`Adres: http://localhost:${env.PORT}`);

    void database.probe.ping().then((connected) => {
      if (connected) {
        logger.info('PostgreSQL bağlantısı doğrulandı.');
        return;
      }

      logger.warn(
        'PostgreSQL bağlantısı kurulamadı. Uygulama çalışıyor, /api/health "degraded" döner.',
      );
    });
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(
        `${env.PORT} portu kullanımda. Başka bir uygulamayı kapatın veya PORT değiştirin.`,
      );
      process.exit(1);
    }

    logger.error('Sunucu hatası.', { message: error.message });
    process.exit(1);
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info(`${signal} alındı, sunucu kapatılıyor.`);

    const forceExit = setTimeout(() => {
      logger.error('Kapanış zaman aşımına uğradı, süreç sonlandırılıyor.');
      process.exit(1);
    }, 10_000);

    forceExit.unref();

    void realtime
      .close()
      .then(() => database.disconnect())
      .then(() => {
        logger.info('Kapanış tamamlandı.');
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error('Sunucu veya veritabanı bağlantısı kapatılamadı.', {
          message: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
