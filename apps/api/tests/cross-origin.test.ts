import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { parseEnv } from '../src/config/env';
import { hashPassword } from '../src/features/password';
import { createTestApp, crossOriginEnv } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const WEB_ORIGIN = 'https://joker-cafe.example.com';
const OTHER_ORIGIN = 'https://saldirgan.example.com';
const OWNER_PASSWORD = 'OwnerTest12!';

const baseSource = {
  DATABASE_URL: 'postgresql://postgres:ornek@localhost:5432/CafeAdisyon?schema=public',
} satisfies NodeJS.ProcessEnv;

let ownerHash = '';

beforeAll(async () => {
  ownerHash = await hashPassword(OWNER_PASSWORD);
});

/** Girişi yapılabilen bir uygulama; CORS_ORIGIN boşsa aynı origin kurulumudur. */
function createScenario(origins: readonly string[] = []) {
  const store = new MemoryStore();
  store.seedUser({
    fullName: 'İşletme Sahibi',
    username: 'owner',
    passwordHash: ownerHash,
    role: 'OWNER',
    isActive: true,
  });
  const env = origins.length === 0 ? undefined : crossOriginEnv(origins);
  return createTestApp({
    databaseConnected: true,
    store,
    ...(env === undefined ? {} : { env }),
  });
}

function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw.map(String) : [String(raw)];
  const session = cookies.find((entry) => entry.startsWith('kafe_session='));
  if (session === undefined) throw new Error('Oturum çerezi bulunamadı.');
  return session;
}

describe('Ayrı barındırma — CORS ve çerez politikası', () => {
  it('CORS_ORIGIN tanımsızken boş liste üretir', () => {
    expect(parseEnv(baseSource).CORS_ORIGIN).toEqual([]);
  });

  it('virgüllü listeyi ayrıştırır ve sondaki eğik çizgiyi atar', () => {
    const env = parseEnv({
      ...baseSource,
      CORS_ORIGIN: ` ${WEB_ORIGIN}/ , https://www.ornek.com `,
    });
    expect(env.CORS_ORIGIN).toEqual([WEB_ORIGIN, 'https://www.ornek.com']);
  });

  it('şema içermeyen origin değerini reddeder', () => {
    expect(() => parseEnv({ ...baseSource, CORS_ORIGIN: 'joker-cafe.example.com' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  it('aynı origin kurulumunda hiçbir CORS başlığı yazmaz', async () => {
    const response = await request(createScenario())
      .get('/api/health')
      .set('Origin', WEB_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('izinli origin için credentials ile CORS başlıklarını yazar', async () => {
    const response = await request(createScenario([WEB_ORIGIN]))
      .get('/api/health')
      .set('Origin', WEB_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toBe('Origin');
  });

  it('izinsiz origin için CORS başlığı yazmaz ve joker kullanmaz', async () => {
    const response = await request(createScenario([WEB_ORIGIN]))
      .get('/api/health')
      .set('Origin', OTHER_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight isteğini izinliye 204, izinsize 403 ile yanıtlar', async () => {
    const app = createScenario([WEB_ORIGIN]);

    const allowed = await request(app)
      .options('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-methods']).toContain('POST');
    expect(allowed.headers['access-control-allow-headers']).toContain('Content-Type');

    const blocked = await request(app)
      .options('/api/auth/login')
      .set('Origin', OTHER_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(blocked.status).toBe(403);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('aynı origin kurulumunda oturum çerezi SameSite=Strict kalır', async () => {
    const response = await request(createScenario())
      .post('/api/auth/login')
      .send({ username: 'owner', password: OWNER_PASSWORD });

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toMatch(/SameSite=Strict/i);
    expect(sessionCookie(response)).toMatch(/HttpOnly/i);
  });

  it('ayrı barındırmada oturum çerezi SameSite=None ve Secure olur', async () => {
    const response = await request(createScenario([WEB_ORIGIN]))
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ username: 'owner', password: OWNER_PASSWORD });

    expect(response.status).toBe(200);
    const cookie = sessionCookie(response);
    // SameSite=None çerezini tarayıcı yalnız Secure ile kabul eder.
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('çıkışta çerezi aynı politikayla temizler', async () => {
    const response = await request(createScenario([WEB_ORIGIN]))
      .post('/api/auth/logout')
      .set('Origin', WEB_ORIGIN);

    expect(response.status).toBe(204);
    const cookie = sessionCookie(response);
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Secure/i);
  });
});
