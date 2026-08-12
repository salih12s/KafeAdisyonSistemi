import { PrismaClient } from '@prisma/client';
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

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
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
