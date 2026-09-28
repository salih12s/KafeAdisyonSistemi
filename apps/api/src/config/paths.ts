import path from 'node:path';

/**
 * apps/api/.env dosyasının yolu.
 * Geliştirmede __dirname = apps/api/src/config, derlemede apps/api/dist/config olur;
 * her iki durumda da iki üst klasör apps/api'dir.
 */
export const API_ROOT = path.resolve(__dirname, '..', '..');

export const ENV_FILE_PATH = path.join(API_ROOT, '.env');

/**
 * Üretimde Express tarafından sunulan React derleme çıktısı. Repoda apps/web/dist;
 * Hostinger paketinde giriş dosyası (main.cjs) bunu WEB_DIST_PATH ile dist/public yapar.
 */
export const WEB_DIST_PATH =
  process.env.WEB_DIST_PATH ?? path.resolve(API_ROOT, '..', 'web', 'dist');

/**
 * Prisma migration klasörü. Canlı demo boş veritabanında şemayı buradan kurar
 * (modules/demo/demo-schema.ts); Hostinger paketinde main.cjs bunu dist/prisma/migrations yapar.
 */
export const MIGRATIONS_PATH =
  process.env.MIGRATIONS_PATH ?? path.join(API_ROOT, 'prisma', 'migrations');
