import { createConnection } from 'mariadb';
import type { PrismaClient } from '../../generated/prisma/client';
import { toMariaDbConfig } from '../../lib/database';
import type { Logger } from '../../lib/logger';
import { DEMO_ACCOUNTS, seedDemoData, wipeDemoData } from './demo-seed';
import { isDemoStale, liveCheckShiftMs } from './demo-schedule';
import { ensureDemoSchema } from './demo-schema';

/**
 * Canlı demonun bakımı (ADR-026): veri her gün yeniden üretilir, açık masalar
 * ve mutfak siparişleri gün boyu "taze" tutulur.
 *
 * Hostinger uygulama sürecini boştayken durdurabildiği için zamanlayıcıya
 * güvenilmez; her API isteği `poke()` çağırır, iş arka planda yapılır.
 */
export interface DemoMaintenance {
  /** Demo verisi şu an (bu ya da başka bir süreçte) silinip yeniden üretiliyor mu? */
  readonly resetting: boolean;
  /** En fazla dakikada bir veritabanına bakar; gerekirse arka planda iş başlatır. */
  poke(now?: Date): void;
  stop(): void;
}

const MINUTE = 60_000;
const POKE_INTERVAL_MS = MINUTE;
/** Başka bir süreç yenilerken daha sık bakılır ki 503 bitince hemen kalksın. */
const POKE_INTERVAL_WHILE_OTHER_RESETS_MS = 10_000;
const FRESHEN_INTERVAL_MS = 10 * MINUTE;
/** Süreç açık kalırsa istek gelmese de bu aralıkla kontrol edilir. */
const TIMER_INTERVAL_MS = 10 * MINUTE;
/** Birden çok süreç aynı veritabanını aynı anda yenilemesin diye MySQL adlı kilidi. */
const RESET_LOCK_NAME = 'kafe_demo_reset';

const OWNER_USERNAME = DEMO_ACCOUNTS.find((account) => account.role === 'OWNER')?.username;

/**
 * Yaşı aralığı aşan açık adisyonları ve kalemlerini ileri kaydırır (bkz.
 * demo-schedule). Kaydırılan adisyon sayısını döndürür.
 */
export async function freshenLiveChecks(client: PrismaClient, now: Date): Promise<number> {
  const open = await client.check.findMany({
    where: { status: 'OPEN' },
    select: { id: true, openedAt: true },
  });
  let shifted = 0;
  for (const check of open) {
    const seconds = Math.floor(liveCheckShiftMs(check.openedAt, now) / 1000);
    if (seconds === 0) continue;
    await client.$transaction([
      client.check.update({
        where: { id: check.id },
        data: { openedAt: new Date(check.openedAt.getTime() + seconds * 1000) },
      }),
      // Masaya sonradan eklenmiş kalem geleceğe kaymasın: en geç bir dakika öncesi.
      // Prisma DateTime alanlarını UTC yazar; karşılaştırma da UTC ile yapılır.
      client.$executeRaw`UPDATE OrderItem SET createdAt = LEAST(DATE_ADD(createdAt, INTERVAL ${seconds} SECOND), UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE) WHERE checkId = ${check.id}`,
    ]);
    shifted += 1;
  }
  return shifted;
}

export interface DemoMaintenanceOptions {
  client: PrismaClient;
  databaseUrl: string;
  logger: Logger;
}

export function createPrismaDemoMaintenance({
  client,
  databaseUrl,
  logger,
}: DemoMaintenanceOptions): DemoMaintenance {
  let resetting = false;
  /** Yenileme kilidini başka bir süreç tutuyor (aynı veritabanını paylaşan ikinci süreç). */
  let otherResetting = false;
  let running = false;
  let schemaReady = false;
  let lastPokeAt = 0;
  let lastFreshenAt = 0;

  /** Demo sahibi hesabı, verinin üretildiği anı taşır (seed onu ilk oluşturur). */
  async function seededAt(): Promise<Date | null> {
    if (OWNER_USERNAME === undefined) return null;
    const owner = await client.user.findUnique({
      where: { username: OWNER_USERNAME },
      select: { createdAt: true },
    });
    return owner?.createdAt ?? null;
  }

  async function reset(): Promise<void> {
    const lock = await createConnection({
      ...toMariaDbConfig(databaseUrl),
      connectTimeout: 10_000,
    });
    try {
      const rows: unknown = await lock.query('SELECT GET_LOCK(?, 0) AS acquired', [
        RESET_LOCK_NAME,
      ]);
      const acquired = Array.isArray(rows) && Number(rows[0]?.acquired) === 1;
      if (!acquired) return;
      // Kilidi beklerken başka bir süreç yenilemeyi bitirmiş olabilir.
      if (!isDemoStale(await seededAt(), new Date())) return;

      resetting = true;
      const startedAt = Date.now();
      logger.info('Demo verisi yenileniyor.');
      await wipeDemoData(client);
      const checks = await seedDemoData(client, new Date(), (step) => logger.info(`Demo: ${step}`));
      lastFreshenAt = Date.now();
      logger.info('Demo verisi hazır.', {
        closedChecks: checks,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });
    } finally {
      resetting = false;
      // Bağlantı kapanınca kilit de bırakılır.
      await lock.end();
    }
  }

  async function check(now: Date): Promise<void> {
    if (!schemaReady) {
      // İlk yayında veritabanı boştur: şema kurulur, ardından demo verisi üretilir.
      // Kurulurken istekler tablo bulamayıp 500 almasın diye 503 döner.
      resetting = true;
      try {
        const applied = await ensureDemoSchema(databaseUrl);
        if (applied > 0) {
          logger.info('Boş demo veritabanına şema kuruldu.', { migrations: applied });
        }
        schemaReady = true;
      } finally {
        resetting = false;
      }
    }
    const rows = await client.$queryRaw<
      Array<{ holder: unknown }>
    >`SELECT IS_USED_LOCK(${RESET_LOCK_NAME}) AS holder`;
    otherResetting = rows[0]?.holder !== null && rows[0]?.holder !== undefined;
    if (otherResetting) return;
    if (isDemoStale(await seededAt(), now)) {
      await reset();
      return;
    }
    if (now.getTime() - lastFreshenAt >= FRESHEN_INTERVAL_MS) {
      lastFreshenAt = now.getTime();
      await freshenLiveChecks(client, now);
    }
  }

  function poke(now = new Date()): void {
    const interval = otherResetting ? POKE_INTERVAL_WHILE_OTHER_RESETS_MS : POKE_INTERVAL_MS;
    if (running || now.getTime() - lastPokeAt < interval) return;
    lastPokeAt = now.getTime();
    running = true;
    check(now)
      .catch((error: unknown) => {
        logger.error('Demo bakımı tamamlanamadı.', {
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = false;
      });
  }

  const timer = setInterval(() => poke(), TIMER_INTERVAL_MS);
  timer.unref();

  return {
    get resetting() {
      return resetting || otherResetting;
    },
    poke,
    stop() {
      clearInterval(timer);
    },
  };
}
