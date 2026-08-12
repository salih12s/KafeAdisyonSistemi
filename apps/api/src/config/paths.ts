import path from 'node:path';

/**
 * apps/api/.env dosyasının yolu.
 * Geliştirmede __dirname = apps/api/src/config, derlemede apps/api/dist/config olur;
 * her iki durumda da iki üst klasör apps/api'dir.
 */
export const API_ROOT = path.resolve(__dirname, '..', '..');

export const ENV_FILE_PATH = path.join(API_ROOT, '.env');

/** apps/web/dist — üretimde Express tarafından sunulan React derleme çıktısı. */
export const WEB_DIST_PATH = path.resolve(API_ROOT, '..', 'web', 'dist');
