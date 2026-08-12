import dotenv from 'dotenv';
import { ENV_FILE_PATH } from '../config/paths';
import { EnvValidationError, parseEnv, type Env } from '../config/env';
import { createPrismaLifecycle } from '../lib/database';
import { createLogger } from '../lib/logger';

function readEnv(): Env | null {
  try {
    return parseEnv(process.env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      process.stderr.write(`${error.message}\n`);
      return null;
    }

    throw error;
  }
}

/**
 * Veritabanı bağlantısını yalnızca `SELECT 1` ile doğrular.
 * Hiçbir tablo oluşturmaz, değiştirmez veya silmez.
 */
async function main(): Promise<number> {
  dotenv.config({ path: ENV_FILE_PATH });

  const env: Env | null = readEnv();

  if (env === null) {
    return 1;
  }

  const logger = createLogger(env.LOG_LEVEL);
  const database = createPrismaLifecycle(env.DATABASE_URL, logger);

  try {
    const connected = await database.probe.ping();

    if (connected) {
      process.stdout.write('PostgreSQL bağlantısı başarılı (SELECT 1).\n');
      return 0;
    }

    process.stderr.write(
      'PostgreSQL bağlantısı kurulamadı. Servisin çalıştığını ve DATABASE_URL değerini kontrol edin.\n',
    );
    return 1;
  } finally {
    await database.disconnect();
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`Beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
