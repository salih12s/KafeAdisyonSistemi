import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../src/config/env';

const validSource = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'mysql://kafe:ornek@127.0.0.1:3306/kafe_adisyon',
  LOG_LEVEL: 'warn',
  JSON_BODY_LIMIT: '2mb',
} satisfies NodeJS.ProcessEnv;

describe('Ortam değişkeni doğrulaması', () => {
  it('geçerli değerleri ayrıştırır ve PORT değerini sayıya çevirir', () => {
    const env = parseEnv(validSource);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.JSON_BODY_LIMIT).toBe('2mb');
  });

  it('eksik alanlar için güvenli varsayılanları kullanır', () => {
    const env = parseEnv({ DATABASE_URL: validSource.DATABASE_URL });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.JSON_BODY_LIMIT).toBe('1mb');
  });

  it('geliştirmede yalnızca bu bilgisayarı dinler', () => {
    const env = parseEnv({ ...validSource, NODE_ENV: 'development' });

    expect(env.HOST).toBe('127.0.0.1');
  });

  it('üretimde tüm arayüzleri dinler', () => {
    const env = parseEnv({ ...validSource, NODE_ENV: 'production' });

    expect(env.HOST).toBe('0.0.0.0');
  });

  it('açıkça verilen HOST değerini korur', () => {
    const env = parseEnv({ ...validSource, HOST: '192.168.1.10' });

    expect(env.HOST).toBe('192.168.1.10');
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

  it('MySQL olmayan bağlantı adresini reddeder', () => {
    expect(() =>
      parseEnv({ ...validSource, DATABASE_URL: 'postgresql://localhost:5432/kafe' }),
    ).toThrow(EnvValidationError);
  });

  it('doldurulmamış CHANGE_ME parolasını reddeder', () => {
    expect(() =>
      parseEnv({
        ...validSource,
        DATABASE_URL: 'mysql://kafe:CHANGE_ME@127.0.0.1:3306/kafe_adisyon',
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

  describe('DEMO_MODE (ADR-026)', () => {
    const demoDatabase = 'mysql://u1_kafe:ornek@127.0.0.1:3306/u1_kafedemo';

    it('varsayılan olarak kapalıdır', () => {
      expect(parseEnv(validSource).DEMO_MODE).toBe(false);
    });

    it('adı "demo" içeren veritabanıyla açılır', () => {
      const env = parseEnv({ ...validSource, DATABASE_URL: demoDatabase, DEMO_MODE: 'true' });
      expect(env.DEMO_MODE).toBe(true);
    });

    it('gerçek işletme veritabanıyla açılmayı reddeder (veri her gün silinirdi)', () => {
      expect(() => parseEnv({ ...validSource, DEMO_MODE: 'true' })).toThrow(/demo/);
    });

    it('"true"/"false" dışındaki değeri reddeder', () => {
      expect(() =>
        parseEnv({ ...validSource, DATABASE_URL: demoDatabase, DEMO_MODE: 'yes' }),
      ).toThrow(EnvValidationError);
    });
  });
});
