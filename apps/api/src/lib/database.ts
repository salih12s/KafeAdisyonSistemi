import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import type { PoolConfig } from 'mariadb';
import { PrismaClient } from '../generated/prisma/client';
import type { Logger } from './logger';

/**
 * Sağlık kontrolünün veritabanına bakış açısı.
 * Testlerde gerçek veritabanı yerine sahte bir uygulama verilebilir.
 */
export interface DatabaseProbe {
  ping(): Promise<boolean>;
}

export interface PrismaLifecycle {
  client: PrismaClient;
  probe: DatabaseProbe;
  disconnect(): Promise<void>;
}

/**
 * Paylaşımlı hosting veritabanı kullanıcısı başına eşzamanlı bağlantıyı sınırlar;
 * `?connection_limit=` ile değiştirilebilir.
 */
const DEFAULT_CONNECTION_LIMIT = 5;

/**
 * `mysql://kullanici:parola@host:port/veritabani` adresini (Prisma CLI biçimi)
 * MariaDB/MySQL sürücüsünün havuz ayarlarına çevirir.
 */
export function toMariaDbConfig(databaseUrl: string): PoolConfig {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:' && url.protocol !== 'mariadb:') {
    throw new Error('DATABASE_URL "mysql://" ile başlamalıdır.');
  }
  return {
    host: url.hostname,
    port: url.port === '' ? 3306 : Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: Number(url.searchParams.get('connection_limit') ?? DEFAULT_CONNECTION_LIMIT),
  };
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaMariaDb(toMariaDbConfig(databaseUrl)),
    log: [],
  });
}

/**
 * Veritabanına yalnızca okuma yapan, hiçbir veriyi değiştirmeyen bağlantı testi.
 * Bağlantı yoksa hata fırlatmaz; sağlık ucunun anlaşılır yanıt verebilmesi için false döner.
 */
export function createPrismaProbe(client: PrismaClient, logger: Logger): DatabaseProbe {
  return {
    async ping(): Promise<boolean> {
      try {
        await client.$queryRaw`SELECT 1`;
        return true;
      } catch (error) {
        logger.warn('Veritabanı bağlantı denemesi başarısız.', {
          reason: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
  };
}

export function createPrismaLifecycle(databaseUrl: string, logger: Logger): PrismaLifecycle {
  const client = createPrismaClient(databaseUrl);

  return {
    client,
    probe: createPrismaProbe(client, logger),
    async disconnect(): Promise<void> {
      await client.$disconnect();
    },
  };
}
