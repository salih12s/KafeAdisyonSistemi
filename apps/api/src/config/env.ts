import { z } from 'zod';
import { databaseNameOf, isDemoDatabaseName } from './database-url';

const MYSQL_URL_PREFIXES = ['mysql://', 'mariadb://'];

/**
 * HOST bilinçli olarak zorunlu değildir.
 * Geliştirmede yalnızca bu bilgisayardan erişilir (127.0.0.1).
 * Üretimde (Hostinger) sunucu tüm arayüzlerden erişilebilir olmalıdır (0.0.0.0).
 */
const DEVELOPMENT_HOST = '127.0.0.1';
const PRODUCTION_HOST = '0.0.0.0';

/**
 * Tarayıcının `Origin` başlığında gönderdiği biçime çevirir: küçük harf alan
 * adı, varsayılan port olmadan, yol/sorgu/parça olmadan. Böylece
 * "https://Ornek.com:443/" ile "https://ornek.com" aynı origin sayılır.
 * Yalnız kök yolu olan http(s) adresleri kabul edilir.
 */
function normalizeOrigin(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
  const hasOnlyOrigin =
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === '';
  return isHttp && hasOnlyOrigin ? url.origin : undefined;
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1, 'HOST boş olamaz.').optional(),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL tanımlı olmalıdır.')
    .refine(
      (value) => MYSQL_URL_PREFIXES.some((prefix) => value.startsWith(prefix)),
      'DATABASE_URL "mysql://" ile başlamalıdır.',
    )
    .refine(
      (value) => !value.includes('CHANGE_ME'),
      'DATABASE_URL hâlâ CHANGE_ME içeriyor. apps/api/.env dosyasına gerçek parolanızı yazın.',
    ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /**
   * Canlı demo (ADR-026): giriş ekranında "Demo ile gir", demo hesaplarına kilit
   * ve günlük veri yenilemesi. Yalnız adı "demo" içeren veritabanıyla açılabilir.
   */
  DEMO_MODE: z
    .enum(['true', 'false'], { message: 'DEMO_MODE "true" veya "false" olmalıdır.' })
    .default('false')
    .transform((value) => value === 'true'),
  JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
  /**
   * Arayüz API'den ayrı barındırıldığında izin verilen origin listesi.
   * Virgülle ayrılır: "https://ornek.com,https://www.ornek.com".
   * Boş bırakılırsa aynı origin varsayılır ve CORS tamamen kapalı kalır.
   */
  CORS_ORIGIN: z
    .string()
    .optional()
    .transform((value, context) => {
      const origins: string[] = [];
      for (const entry of (value ?? '').split(',')) {
        const trimmed = entry.trim();
        if (trimmed.length === 0) continue;
        const origin = normalizeOrigin(trimmed);
        if (origin === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `CORS_ORIGIN girdisi "https://alanadi.com" biçiminde olmalıdır: ${trimmed}`,
          });
          return z.NEVER;
        }
        origins.push(origin);
      }
      return origins;
    }),
});

type RawEnv = z.infer<typeof envSchema>;

export interface Env extends Omit<RawEnv, 'HOST'> {
  HOST: string;
}

/** Ortam değişkeni doğrulaması başarısız olduğunda okunabilir bir hata üretir. */
export class EnvValidationError extends Error {
  public readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Ortam değişkenleri geçersiz:\n- ${issues.join('\n- ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Ortam değişkenlerini doğrular. Hatalıysa stack trace yerine
 * hangi değişkenin neden geçersiz olduğunu söyleyen bir hata fırlatır.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const field = issue.path.join('.');
      return field.length > 0 ? `${field}: ${issue.message}` : issue.message;
    });

    throw new EnvValidationError(issues);
  }

  const { HOST, ...rest } = result.data;

  // Demo modu veriyi her gün siler; gerçek bir işletme veritabanına asla bağlanmaz.
  if (rest.DEMO_MODE && !isDemoDatabaseName(databaseNameOf(rest.DATABASE_URL))) {
    throw new EnvValidationError([
      'DEMO_MODE: yalnız adı "demo" içeren bir veritabanıyla açılabilir (ör. kafe_adisyon_demo).',
    ]);
  }

  return {
    ...rest,
    HOST: HOST ?? (rest.NODE_ENV === 'production' ? PRODUCTION_HOST : DEVELOPMENT_HOST),
  };
}
