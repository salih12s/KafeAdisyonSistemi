import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as createSocketClient } from 'socket.io-client';
import { parseEnv } from '../../src/config/env';
import { createOrderEventHub } from '../../src/modules/orders/order-events';
import { hashPassword } from '../../src/modules/identity/password';
import { createSilentLogger } from '../../src/lib/logger';
import { createRealtimeServer } from '../../src/modules/orders/order-realtime';
import { createTestApp, crossOriginEnv } from '../helpers/test-app';
import { MemoryStore } from '../helpers/memory-store';

const WEB_ORIGIN = 'https://saydam-cafe.example.com';
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
function createScenario(origins: readonly string[] = [], store = new MemoryStore()) {
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

  it('origin değerini tarayıcının gönderdiği biçime normalleştirir', () => {
    const env = parseEnv({
      ...baseSource,
      CORS_ORIGIN: 'https://Saydam-Cafe.Example.com:443,http://localhost:80/',
    });
    expect(env.CORS_ORIGIN).toEqual([WEB_ORIGIN, 'http://localhost']);
  });

  it('yol, sorgu, kullanıcı bilgisi veya http(s) dışı şema içeren origin değerini reddeder', () => {
    for (const value of [
      'https://ornek.com/uygulama',
      'https://ornek.com?x=1',
      'ftp://ornek.com',
      'https://kullanici@ornek.com',
    ]) {
      expect(() => parseEnv({ ...baseSource, CORS_ORIGIN: value })).toThrow(/CORS_ORIGIN/);
    }
  });

  it('şema içermeyen origin değerini reddeder', () => {
    expect(() => parseEnv({ ...baseSource, CORS_ORIGIN: 'saydam-cafe.example.com' })).toThrow(
      /CORS_ORIGIN/,
    );
  });

  it('aynı origin kurulumunda hiçbir CORS başlığı yazmaz', async () => {
    const response = await request(createScenario()).get('/api/health').set('Origin', WEB_ORIGIN);

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

  it('izinsiz origin ve origin taşımayan yanıtlara da Vary: Origin yazar', async () => {
    const app = createScenario([WEB_ORIGIN]);

    const foreign = await request(app).get('/api/health').set('Origin', OTHER_ORIGIN);
    expect(foreign.headers.vary).toBe('Origin');

    const withoutOrigin = await request(app).get('/api/health');
    expect(withoutOrigin.headers.vary).toBe('Origin');
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
    // Reçete kaydı PUT kullanır.
    expect(allowed.headers['access-control-allow-methods']).toContain('PUT');
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

describe('Ayrı barındırma — siteler arası istek sahteciliği (CSRF)', () => {
  const API_HOST = 'api.saydam-cafe.example.com';

  async function loggedIn(origins: readonly string[]) {
    const store = new MemoryStore();
    const app = createScenario(origins, store);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: OWNER_PASSWORD });
    return { app, store, cookie: sessionCookie(login).split(';')[0] ?? '' };
  }

  const attackerStaff = {
    fullName: 'Destek Hesabi',
    username: 'support.x',
    password: 'Attacker!Pass123',
    role: 'OWNER',
  };

  it('izinsiz origin kaynaklı form gönderimini reddeder ve personel oluşturmaz', async () => {
    const { app, cookie } = await loggedIn([WEB_ORIGIN]);

    const forged = await request(app)
      .post('/api/staff')
      .set('Origin', OTHER_ORIGIN)
      .set('Cookie', cookie)
      .type('form')
      .send(attackerStaff);
    expect(forged.status).toBe(403);

    const attackerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: attackerStaff.username, password: attackerStaff.password });
    expect(attackerLogin.status).toBe(401);
  });

  it('izinsiz, "null" ve sonek eklenmiş origin kaynaklı mutation isteklerini reddeder', async () => {
    const { app, cookie } = await loggedIn([WEB_ORIGIN]);

    for (const origin of [OTHER_ORIGIN, 'null', `${WEB_ORIGIN}.kotu.com`]) {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Origin', origin)
        .set('Cookie', cookie);
      expect(response.status).toBe(403);
    }
  });

  it('izinli origin, API ile aynı origin ve Origin taşımayan mutation isteklerini kabul eder', async () => {
    const { app, cookie } = await loggedIn([WEB_ORIGIN]);
    const create = (username: string) => ({ ...attackerStaff, username, role: 'WAITER' });

    const allowed = await request(app)
      .post('/api/staff')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie)
      .send(create('izinli.origin'));
    expect(allowed.status).toBe(201);

    const sameOrigin = await request(app)
      .post('/api/staff')
      .set('Host', API_HOST)
      .set('Origin', `https://${API_HOST}`)
      .set('Cookie', cookie)
      .send(create('ayni.origin'));
    expect(sameOrigin.status).toBe(201);

    const withoutOrigin = await request(app)
      .post('/api/staff')
      .set('Cookie', cookie)
      .send(create('originsiz'));
    expect(withoutOrigin.status).toBe(201);
  });

  it('izinsiz origin kaynaklı okuma isteğini işler ama yanıtı CORS ile açmaz', async () => {
    const { app, cookie } = await loggedIn([WEB_ORIGIN]);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Origin', OTHER_ORIGIN)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('form gövdesini ayrıştırmaz; aynı origin kurulumunda da yalnız JSON kabul edilir', async () => {
    const { app, cookie } = await loggedIn([]);

    const response = await request(app)
      .post('/api/staff')
      .set('Cookie', cookie)
      .type('form')
      .send({ ...attackerStaff, role: 'WAITER' });
    expect(response.status).toBe(400);
  });

  it('Socket.IO el sıkışmasını izinsiz origin için reddeder', async () => {
    const { app, store, cookie } = await loggedIn([WEB_ORIGIN]);
    const server = createServer(app);
    const realtime = createRealtimeServer(
      server,
      store,
      createOrderEventHub(),
      createSilentLogger(),
      [WEB_ORIGIN],
    );
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;

    const attempt = (origin: string) =>
      new Promise<'connected' | 'rejected'>((resolve) => {
        const socket = createSocketClient(url, {
          transports: ['websocket'],
          reconnection: false,
          extraHeaders: { Cookie: cookie, Origin: origin },
        });
        socket.on('connect', () => {
          socket.disconnect();
          resolve('connected');
        });
        socket.on('connect_error', () => {
          socket.disconnect();
          resolve('rejected');
        });
      });

    try {
      await expect(attempt(OTHER_ORIGIN)).resolves.toBe('rejected');
      await expect(attempt(WEB_ORIGIN)).resolves.toBe('connected');
      await expect(attempt(url)).resolves.toBe('connected');
    } finally {
      await realtime.close();
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
