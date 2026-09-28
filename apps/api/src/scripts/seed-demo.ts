/**
 * Boş bir demo veritabanına vitrin verisi yazar (bkz. modules/demo/demo-seed.ts).
 *
 * Güvenlik: yalnız adı "demo" içeren ve hiç kullanıcısı olmayan bir veritabanında
 * çalışır. Gerçek işletme veritabanına yazmaz (AGENTS.md §9, §11).
 *
 * Kullanım: DATABASE_URL="mysql://.../kafe_adisyon_demo" npm run demo:seed
 * DEMO_NOW (ISO tarih) verilirse "bugün"ün verisi o ana göre üretilir; ekran
 * görüntüsünü gece alırken bile gün içi bir an gösterilebilir.
 */
import dotenv from 'dotenv';
import { ENV_FILE_PATH } from '../config/paths';
import { parseEnv } from '../config/env';
import { databaseNameOf, isDemoDatabaseName } from '../config/database-url';
import { createPrismaClient } from '../lib/database';
import { DEMO_PASSWORD, seedDemoData } from '../modules/demo/demo-seed';

async function main(): Promise<number> {
  dotenv.config({ path: ENV_FILE_PATH });
  const env = parseEnv(process.env);
  const now = process.env.DEMO_NOW === undefined ? new Date() : new Date(process.env.DEMO_NOW);
  if (Number.isNaN(now.getTime())) {
    process.stderr.write(
      'DEMO_NOW geçerli bir ISO tarih olmalıdır (ör. 2026-09-25T15:40:00+03:00).\n',
    );
    return 1;
  }
  const name = databaseNameOf(env.DATABASE_URL);
  if (!isDemoDatabaseName(name)) {
    process.stderr.write(
      `"${name}" bir demo veritabanı değil. Demo verisi yalnız adı "demo" içeren boş bir veritabanına yazılır.\n`,
    );
    return 1;
  }
  const client = createPrismaClient(env.DATABASE_URL);
  try {
    if ((await client.user.count()) > 0) {
      process.stderr.write(`"${name}" boş değil; demo verisi yalnız boş veritabanına yazılır.\n`);
      return 1;
    }
    const checks = await seedDemoData(client, now, (step) => process.stdout.write(`${step}\n`));
    process.stdout.write(
      `Hazır: ${checks} kapanmış adisyon. Giriş: demo / ${DEMO_PASSWORD} ` +
        `(kasiyer: elif, garson: mert, mutfak: mutfak — aynı şifre)\n`,
    );
    return 0;
  } finally {
    await client.$disconnect();
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `Demo verisi üretilemedi: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
