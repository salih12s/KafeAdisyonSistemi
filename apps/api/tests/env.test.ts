import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../src/config/env';

const validSource = {
  NODE_ENV: 'production',
  PORT: '3000',
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://postgres:ornek@localhost:5432/CafeAdisyon',
  LOG_LEVEL: 'warn',
  JSON_BODY_LIMIT: '2mb',
} satisfies NodeJS.ProcessEnv;

describe('Ortam değişkeni doğrulaması', () => {
  it('geçerli değerleri ayrıştırır ve PORT değerini sayıya çevirir', () => {
    const env = parseEnv(validSource);

    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('warn');
  });

  it('eksik alanlar için güvenli varsayılanları kullanır', () => {
    const env = parseEnv({ DATABASE_URL: validSource.DATABASE_URL });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.JSON_BODY_LIMIT).toBe('1mb');
  });

  it('DATABASE_URL yoksa okunabilir hata verir', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);

    try {
      parseEnv({});
      expect.unreachable('parseEnv hata fırlatmalıydı.');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);

      if (error instanceof EnvValidationError) {
        expect(error.issues.join(' ')).toContain('DATABASE_URL');
      }
    }
  });

  it('PostgreSQL olmayan bağlantı adresini reddeder', () => {
    expect(() => parseEnv({ ...validSource, DATABASE_URL: 'mysql://localhost:3306/kafe' })).toThrow(
      EnvValidationError,
    );
  });

  it('doldurulmamış CHANGE_ME parolasını reddeder', () => {
    expect(() =>
      parseEnv({
        ...validSource,
        DATABASE_URL: 'postgresql://postgres:CHANGE_ME@localhost:5432/CafeAdisyon',
      }),
    ).toThrow(/CHANGE_ME/);
  });

  it('geçersiz PORT değerini reddeder', () => {
    expect(() => parseEnv({ ...validSource, PORT: '70000' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...validSource, PORT: 'abc' })).toThrow(EnvValidationError);
  });

  it('bilinmeyen NODE_ENV değerini reddeder', () => {
    expect(() => parseEnv({ ...validSource, NODE_ENV: 'staging' })).toThrow(EnvValidationError);
  });
});
