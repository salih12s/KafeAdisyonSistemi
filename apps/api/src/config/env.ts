import { z } from 'zod';

const POSTGRES_URL_PREFIXES = ['postgresql://', 'postgres://'];

/**
 * HOST bilinçli olarak zorunlu değildir.
 * Geliştirmede yalnızca bu bilgisayardan erişilir (127.0.0.1).
 * Üretimde (Railway) sunucu tüm arayüzlerden erişilebilir olmalıdır (0.0.0.0).
 */
const DEVELOPMENT_HOST = '127.0.0.1';
const PRODUCTION_HOST = '0.0.0.0';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1, 'HOST boş olamaz.').optional(),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL tanımlı olmalıdır.')
    .refine(
      (value) => POSTGRES_URL_PREFIXES.some((prefix) => value.startsWith(prefix)),
      'DATABASE_URL "postgresql://" veya "postgres://" ile başlamalıdır.',
    )
    .refine(
      (value) => !value.includes('CHANGE_ME'),
      'DATABASE_URL hâlâ CHANGE_ME içeriyor. apps/api/.env dosyasına gerçek parolanızı yazın.',
    ),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
  /**
   * Arayüz API'den ayrı barındırıldığında izin verilen origin listesi.
   * Virgülle ayrılır: "https://ornek.com,https://www.ornek.com".
   * Boş bırakılırsa aynı origin varsayılır ve CORS tamamen kapalı kalır.
   */
  CORS_ORIGIN: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter((origin) => origin.length > 0),
    )
    .refine(
      (origins) => origins.every((origin) => /^https?:\/\/[^/\s]+$/.test(origin)),
      'CORS_ORIGIN girdileri "https://alanadi.com" biçiminde olmalıdır (sonda / olmadan).',
    ),
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

  return {
    ...rest,
    HOST: HOST ?? (rest.NODE_ENV === 'production' ? PRODUCTION_HOST : DEVELOPMENT_HOST),
  };
}
