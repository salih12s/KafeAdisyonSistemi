import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createConnection } from 'mariadb';
import { MIGRATIONS_PATH } from '../../config/paths';
import { toMariaDbConfig } from '../../lib/database';

/**
 * Canlı demonun ilk kurulumu (ADR-026): veritabanında HİÇ tablo yoksa migration
 * SQL'lerini sırayla uygular ve Prisma'nın `_prisma_migrations` kaydını yazar.
 * Tablo varsa hiçbir şey yapmaz; mevcut bir şemayı değiştirmez ya da silmez.
 *
 * Hostinger paketinde Prisma CLI yoktur; böylece şema için veritabanına dışarıdan
 * bağlanmak (ve parolayı paylaşmak) gerekmez. Döndürdüğü değer uygulanan
 * migration sayısıdır.
 */
export async function ensureDemoSchema(
  databaseUrl: string,
  migrationsPath = MIGRATIONS_PATH,
): Promise<number> {
  const connection = await createConnection({
    ...toMariaDbConfig(databaseUrl),
    multipleStatements: true,
    connectTimeout: 10_000,
  });
  try {
    // Aynı anda açılan iki süreç şemayı iki kez kurmasın.
    await connection.query("SELECT GET_LOCK('kafe_demo_schema', 30)");
    const rows: unknown = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    if (!Array.isArray(rows) || Number(rows[0]?.count) > 0) return 0;

    const migrations = fs
      .readdirSync(migrationsPath)
      .filter((name) => fs.existsSync(path.join(migrationsPath, name, 'migration.sql')))
      .sort();
    await connection.query(`CREATE TABLE _prisma_migrations (
      id VARCHAR(36) PRIMARY KEY NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      finished_at DATETIME(3),
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at DATETIME(3),
      started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    for (const name of migrations) {
      const sql = fs.readFileSync(path.join(migrationsPath, name, 'migration.sql'));
      await connection.query(sql.toString('utf8'));
      // Checksum, Prisma'nın kullandığı gibi dosyanın SHA-256 özetidir; ileride
      // `prisma migrate status` bu şemayı kendi kurmuş gibi görür.
      await connection.query(
        'INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (?, ?, NOW(3), ?, NOW(3), 1)',
        [randomUUID(), createHash('sha256').update(sql).digest('hex'), name],
      );
    }
    return migrations.length;
  } finally {
    await connection.end();
  }
}
