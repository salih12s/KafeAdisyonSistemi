import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { API_ERROR_CODES, DEMO_RESETTING_MESSAGE, type UserRole } from '@kafe/contracts';
import { hashPassword } from '../../src/modules/identity/password';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/modules/demo/demo-seed';
import type { DemoMaintenance } from '../../src/modules/demo/demo-maintenance';
import { createTestApp, demoEnv, testEnv } from '../helpers/test-app';
import { MemoryStore } from '../helpers/memory-store';

let demoHash = '';
beforeAll(async () => {
  demoHash = await hashPassword(DEMO_PASSWORD);
});

/** Fixture: demo hesaplarının hepsi + ziyaretçinin ekleyebileceği sıradan bir personel. */
function demoStore(): MemoryStore {
  const store = new MemoryStore();
  for (const account of DEMO_ACCOUNTS) {
    store.seedUser({ ...account, passwordHash: demoHash });
  }
  store.seedUser({
    fullName: 'Ziyaretçi Ekledi',
    username: 'yeni',
    passwordHash: demoHash,
    role: 'WAITER',
  });
  return store;
}

/** Fake bakım nesnesi; `poke` bir mock'tur, çağrıldığını doğrularız. */
function fakeMaintenance(resetting = false): DemoMaintenance & { poke: ReturnType<typeof vi.fn> } {
  return { resetting, poke: vi.fn(), stop: vi.fn() };
}

function demoApp(store = demoStore(), maintenance = fakeMaintenance()): Express {
  return createTestApp({
    databaseConnected: true,
    store,
    env: demoEnv,
    demoMaintenance: maintenance,
  });
}

async function demoLogin(app: Express, role: UserRole): Promise<string> {
  const response = await request(app).post('/api/auth/demo-login').send({ role });
  expect(response.status).toBe(200);
  const cookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Oturum çerezi alınamadı.');
  }
  return cookies[0].split(';')[0] ?? '';
}

async function staffId(store: MemoryStore, username: string): Promise<string> {
  const member = (await store.listStaff()).find((candidate) => candidate.username === username);
  if (member === undefined) throw new Error(`${username} yok.`);
  return member.id;
}

describe('GET /api/demo', () => {
  it('demo kapalıyken enabled: false ve boş hesap listesi döner', async () => {
    const response = await request(
      createTestApp({ databaseConnected: true, store: demoStore(), env: testEnv }),
    ).get('/api/demo');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: false, resetting: false, accounts: [] });
  });

  it('demo açıkken dört rolün hesabını listeler, şifre göndermez', async () => {
    const response = await request(demoApp()).get('/api/demo');
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(true);
    expect(response.body.accounts.map((account: { role: string }) => account.role)).toEqual([
      'OWNER',
      'CASHIER',
      'WAITER',
      'KITCHEN',
    ]);
    expect(JSON.stringify(response.body)).not.toContain(DEMO_PASSWORD);
  });
});

describe('POST /api/auth/demo-login', () => {
  it.each(['OWNER', 'CASHIER', 'WAITER', 'KITCHEN'] as const)(
    '%s rolüyle şifresiz giriş yapar ve oturum açar',
    async (role) => {
      const app = demoApp();
      const cookie = await demoLogin(app, role);
      const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(200);
      expect(me.body.user.role).toBe(role);
    },
  );

  it('demo kapalıyken uç yoktur (404): gerçek veride şifresiz giriş açılamaz', async () => {
    const app = createTestApp({ databaseConnected: true, store: demoStore(), env: testEnv });
    const response = await request(app).post('/api/auth/demo-login').send({ role: 'OWNER' });
    expect(response.status).toBe(404);
  });

  it('geçersiz rolü 400 ile reddeder', async () => {
    const response = await request(demoApp()).post('/api/auth/demo-login').send({ role: 'ADMIN' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });

  it('demo hesabı pasifse giriş 401 ile reddedilir', async () => {
    const store = new MemoryStore();
    store.seedUser({ ...DEMO_ACCOUNTS[0]!, passwordHash: demoHash, isActive: false });
    const response = await request(demoApp(store)).post('/api/auth/demo-login').send({
      role: 'OWNER',
    });
    expect(response.status).toBe(401);
  });
});

describe('Demo hesap kilidi', () => {
  it('demo sahibi kendi şifresini değiştiremez (403)', async () => {
    const app = demoApp();
    const cookie = await demoLogin(app, 'OWNER');
    const response = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: DEMO_PASSWORD, newPassword: 'BaskaSifre12!' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(API_ERROR_CODES.FORBIDDEN);
  });

  it('demo garsonu pasife alınamaz ve rolü değiştirilemez (403)', async () => {
    const store = demoStore();
    const app = demoApp(store);
    const cookie = await demoLogin(app, 'OWNER');
    const response = await request(app)
      .patch(`/api/staff/${await staffId(store, 'mert')}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Mert Demir', role: 'KITCHEN', isActive: false });
    expect(response.status).toBe(403);
    // Kilit gerçekten işe yaradı mı? Garson hâlâ demo girişi yapabilmeli.
    await demoLogin(app, 'WAITER');
  });

  it('demo personelinin şifresi sıfırlanamaz (403)', async () => {
    const store = demoStore();
    const app = demoApp(store);
    const cookie = await demoLogin(app, 'OWNER');
    const response = await request(app)
      .post(`/api/staff/${await staffId(store, 'elif')}/reset-password`)
      .set('Cookie', cookie)
      .send({ password: 'BaskaSifre12!' });
    expect(response.status).toBe(403);
  });

  it('ziyaretçinin eklediği personel normal şekilde düzenlenir (200)', async () => {
    const store = demoStore();
    const app = demoApp(store);
    const cookie = await demoLogin(app, 'OWNER');
    const response = await request(app)
      .patch(`/api/staff/${await staffId(store, 'yeni')}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Yeni Ad', role: 'WAITER', isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.staff.isActive).toBe(false);
  });

  it('kilit oturumsuz istekte yetki kontrolünün önüne geçmez (401)', async () => {
    const store = demoStore();
    const response = await request(demoApp(store))
      .patch(`/api/staff/${await staffId(store, 'mert')}`)
      .send({ fullName: 'Mert Demir', role: 'WAITER', isActive: false });
    expect(response.status).toBe(401);
  });

  it('demo kapalıyken kilit yoktur: sahip kendi şifresini değiştirebilir', async () => {
    const store = demoStore();
    const app = createTestApp({ databaseConnected: true, store, env: testEnv });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'demo', password: DEMO_PASSWORD });
    const cookie = String(login.headers['set-cookie']?.[0] ?? '').split(';')[0] ?? '';
    const response = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: DEMO_PASSWORD, newPassword: 'BaskaSifre12!' });
    expect(response.status).toBe(204);
  });
});

describe('Demo verisi yenilenirken', () => {
  it('her API isteği bakımı dürter (poke çağrılır)', async () => {
    const maintenance = fakeMaintenance();
    await request(demoApp(demoStore(), maintenance)).get('/api/health');
    expect(maintenance.poke).toHaveBeenCalledTimes(1);
  });

  it('iş uçları 503 döner; yarım veriyle işlem yapılmaz', async () => {
    const app = demoApp(demoStore(), fakeMaintenance(true));
    const response = await request(app).post('/api/auth/demo-login').send({ role: 'OWNER' });
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      code: API_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: DEMO_RESETTING_MESSAGE,
    });
  });

  it('sağlık ve demo bilgisi uçları çalışmaya devam eder', async () => {
    const app = demoApp(demoStore(), fakeMaintenance(true));
    expect((await request(app).get('/api/health')).status).toBe(200);
    const demo = await request(app).get('/api/demo');
    expect(demo.status).toBe(200);
    expect(demo.body.resetting).toBe(true);
  });
});
