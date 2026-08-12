import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { API_ERROR_CODES, type UserRole } from '@kafe/contracts';
import { hashSessionToken } from '../src/features/identity-service';
import { hashPassword, verifyPassword } from '../src/features/password';
import { createTestApp, testEnv } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const OWNER_PASSWORD = 'OwnerTest12!';
const STAFF_PASSWORD = 'StaffTest12!';
let ownerHash = '';
let staffHash = '';

beforeAll(async () => {
  [ownerHash, staffHash] = await Promise.all([
    hashPassword(OWNER_PASSWORD),
    hashPassword(STAFF_PASSWORD),
  ]);
});

function createScenario(role: UserRole = 'OWNER', isActive = true, production = false) {
  const store = new MemoryStore();
  const user = store.seedUser({
    fullName: role === 'OWNER' ? 'İşletme Sahibi' : 'Test Personeli',
    username: role.toLowerCase(),
    passwordHash: role === 'OWNER' ? ownerHash : staffHash,
    role,
    isActive,
  });
  const env = production ? { ...testEnv, NODE_ENV: 'production' as const } : testEnv;
  return { store, user, app: createTestApp({ databaseConnected: true, store, env }) };
}

async function login(app: Express, username = 'owner', password = OWNER_PASSWORD): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  expect(response.status).toBe(200);
  const cookies: unknown = response.headers['set-cookie'];
  expect(Array.isArray(cookies)).toBe(true);
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Session cookie alınamadı.');
  }
  return cookies[0].split(';')[0] ?? '';
}

function firstCookie(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Session cookie alınamadı.');
  }
  return cookies[0];
}

describe('Setup ve authentication', () => {
  it('aktif owner yokken setup durumunu false döndürür', async () => {
    const store = new MemoryStore();
    const response = await request(createTestApp({ databaseConnected: true, store })).get(
      '/api/setup/status',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ initialized: false });
  });

  it('aktif owner varken setup durumunu true döndürür', async () => {
    const { app } = createScenario();
    const response = await request(app).get('/api/setup/status');
    expect(response.body).toEqual({ initialized: true });
  });

  it('başarılı girişte güvenli kullanıcıyı ve HttpOnly cookie döndürür', async () => {
    const { app } = createScenario();
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: ' OWNER ', password: OWNER_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ username: 'owner', role: 'OWNER' });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(firstCookie(response)).toContain('kafe_session=');
    expect(firstCookie(response)).toContain('HttpOnly');
    expect(firstCookie(response)).toContain('SameSite=Strict');
  });

  it('production cookie üzerinde Secure kullanır', async () => {
    const { app } = createScenario('OWNER', true, true);
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: OWNER_PASSWORD });
    expect(firstCookie(response)).toContain('Secure');
  });

  it('yanlış username ve yanlış password için aynı genel hatayı döndürür', async () => {
    const { app } = createScenario();
    const missing = await request(app)
      .post('/api/auth/login')
      .send({ username: 'olmayan', password: STAFF_PASSWORD });
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: STAFF_PASSWORD });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body.error.message).toBe('Kullanıcı adı veya şifre hatalı.');
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });

  it('pasif kullanıcıyı reddeder', async () => {
    const { app } = createScenario('OWNER', false);
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'owner', password: OWNER_PASSWORD });
    expect(response.status).toBe(401);
  });

  it('session tokenı veritabanında yalnız hash olarak tutar', async () => {
    const { app, store } = createScenario();
    const cookie = await login(app);
    const rawToken = cookie.slice(cookie.indexOf('=') + 1);
    expect(store.sessions[0]?.tokenHash).toBe(hashSessionToken(rawToken));
    expect(store.sessions[0]?.tokenHash).not.toBe(rawToken);
  });

  it('auth/me geçerli session ile çalışır ve logout sessionı iptal eder', async () => {
    const { app, store } = createScenario();
    const cookie = await login(app);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'owner', role: 'OWNER' });
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(store.sessions).toHaveLength(0);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('süresi geçmiş ve iptal edilmiş sessionı reddeder', async () => {
    const { app, store, user } = createScenario();
    store.seedSession(user.id, hashSessionToken('expired-token'), new Date('2020-01-01T00:00:00Z'));
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', 'kafe_session=expired-token')).status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set('Cookie', 'kafe_session=revoked-token')).status,
    ).toBe(401);
  });

  it('şifre değişiminde mevcut şifreyi doğrular, diğer sessionları iptal eder ve audit yazar', async () => {
    const { app, store, user } = createScenario();
    const cookie = await login(app);
    store.seedSession(user.id, hashSessionToken('other-token'), new Date(Date.now() + 60_000));
    const response = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .send({ currentPassword: OWNER_PASSWORD, newPassword: 'YeniOwner12!' });
    expect(response.status).toBe(204);
    expect(store.sessions).toHaveLength(1);
    expect(store.audits.some((audit) => audit.action === 'PASSWORD_CHANGED')).toBe(true);
    await expect(
      verifyPassword('YeniOwner12!', store.getUser('owner')?.passwordHash ?? ''),
    ).resolves.toBe(true);
  });
});

describe('Authorization ve personel', () => {
  it('giriş yapılmamış yönetim isteğini 401 ile reddeder', async () => {
    const { app } = createScenario();
    const response = await request(app).get('/api/staff');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(API_ERROR_CODES.UNAUTHORIZED);
  });

  for (const role of ['CASHIER', 'WAITER', 'KITCHEN'] as const) {
    it(`${role} yönetim endpointine erişemez`, async () => {
      const { app } = createScenario(role);
      const cookie = await login(app, role.toLowerCase(), STAFF_PASSWORD);
      const response = await request(app).get('/api/staff').set('Cookie', cookie);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(API_ERROR_CODES.FORBIDDEN);
    });
  }

  it('owner personel oluşturur ve cevap şifre içermez', async () => {
    const { app, store } = createScenario();
    const cookie = await login(app);
    const response = await request(app).post('/api/staff').set('Cookie', cookie).send({
      fullName: 'Mustafa Yılmaz',
      username: 'mustafa',
      password: STAFF_PASSWORD,
      role: 'WAITER',
    });
    expect(response.status).toBe(201);
    expect(response.body.staff).toMatchObject({
      username: 'mustafa',
      role: 'WAITER',
      isActive: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(store.audits.some((audit) => audit.action === 'STAFF_CREATED')).toBe(true);
  });

  it('aynı username için 409 döndürür', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    const body = {
      fullName: 'İkinci Owner',
      username: 'owner',
      password: STAFF_PASSWORD,
      role: 'CASHIER',
    };
    expect((await request(app).post('/api/staff').set('Cookie', cookie).send(body)).status).toBe(
      409,
    );
  });

  it('personeli günceller ve pasife alındığında sessionlarını iptal eder', async () => {
    const { app, store, user: owner } = createScenario();
    const staff = store.seedUser({
      fullName: 'Garson',
      username: 'garson',
      passwordHash: staffHash,
      role: 'WAITER',
    });
    store.seedSession(staff.id, hashSessionToken('staff-session'), new Date(Date.now() + 60_000));
    const cookie = await login(app);
    const response = await request(app)
      .patch(`/api/staff/${staff.id}`)
      .set('Cookie', cookie)
      .send({ fullName: 'Garson Güncel', role: 'CASHIER', isActive: false });
    expect(response.status).toBe(200);
    expect(response.body.staff).toMatchObject({ role: 'CASHIER', isActive: false });
    expect(store.sessions.every((session) => session.userId === owner.id)).toBe(true);
  });

  it('son owner pasife alınamaz veya başka role geçirilemez', async () => {
    const { app, user } = createScenario();
    const cookie = await login(app);
    const passive = await request(app)
      .patch(`/api/staff/${user.id}`)
      .set('Cookie', cookie)
      .send({ fullName: user.fullName, role: 'OWNER', isActive: false });
    const demote = await request(app)
      .patch(`/api/staff/${user.id}`)
      .set('Cookie', cookie)
      .send({ fullName: user.fullName, role: 'CASHIER', isActive: true });
    expect(passive.status).toBe(409);
    expect(demote.status).toBe(409);
  });

  it('kullanıcı kendi hesabını pasife alamaz', async () => {
    const { app, store } = createScenario();
    store.seedUser({
      fullName: 'Diğer Owner',
      username: 'owner2',
      passwordHash: ownerHash,
      role: 'OWNER',
    });
    const owner = store.getUser('owner');
    const cookie = await login(app);
    const response = await request(app)
      .patch(`/api/staff/${owner?.id ?? ''}`)
      .set('Cookie', cookie)
      .send({ fullName: 'İşletme Sahibi', role: 'OWNER', isActive: false });
    expect(response.status).toBe(409);
  });

  it('şifre sıfırlama tüm hedef sessionlarını iptal eder ve audit içinde secret tutmaz', async () => {
    const { app, store } = createScenario();
    const staff = store.seedUser({
      fullName: 'Garson',
      username: 'garson',
      passwordHash: staffHash,
      role: 'WAITER',
    });
    store.seedSession(staff.id, hashSessionToken('staff-session'), new Date(Date.now() + 60_000));
    const cookie = await login(app);
    const response = await request(app)
      .post(`/api/staff/${staff.id}/reset-password`)
      .set('Cookie', cookie)
      .send({ password: 'YeniStaff12!' });
    expect(response.status).toBe(204);
    expect(store.sessions.some((session) => session.userId === staff.id)).toBe(false);
    expect(JSON.stringify(store.audits)).not.toContain('YeniStaff12!');
    expect(JSON.stringify(store.audits)).not.toContain('token');
  });
});

describe('İşletme, salon, masa ve floor plan', () => {
  it('authenticated kullanıcı işletme ayarını okur; yalnız owner günceller', async () => {
    const { app, store } = createScenario();
    const cookie = await login(app);
    const updated = await request(app)
      .patch('/api/business-settings')
      .set('Cookie', cookie)
      .send({ businessName: 'Kafe', phone: '', address: 'Merkez' });
    expect(updated.status).toBe(200);
    expect(updated.body.settings).toMatchObject({
      businessName: 'Kafe',
      phone: null,
      address: 'Merkez',
    });
    expect((await request(app).get('/api/business-settings').set('Cookie', cookie)).status).toBe(
      200,
    );
    expect(store.audits.some((audit) => audit.action === 'BUSINESS_UPDATED')).toBe(true);
  });

  it('owner olmayan işletme güncellemesi 403 döndürür', async () => {
    const { app } = createScenario('CASHIER');
    const cookie = await login(app, 'cashier', STAFF_PASSWORD);
    expect(
      (
        await request(app)
          .patch('/api/business-settings')
          .set('Cookie', cookie)
          .send({ businessName: 'Kafe' })
      ).status,
    ).toBe(403);
  });

  it('salon oluşturur, duplicate adı reddeder ve günceller', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/areas')
      .set('Cookie', cookie)
      .send({ name: 'Bahçe', sortOrder: 2 });
    expect(created.status).toBe(201);
    expect(
      (
        await request(app)
          .post('/api/areas')
          .set('Cookie', cookie)
          .send({ name: ' bahçe ', sortOrder: 3 })
      ).status,
    ).toBe(409);
    const updated = await request(app)
      .patch(`/api/areas/${created.body.area.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Teras', sortOrder: 1, isActive: true });
    expect(updated.body.area).toMatchObject({ name: 'Teras', sortOrder: 1 });
  });

  it('masa oluşturur; aynı salonda duplicate adı reddeder, farklı salonda kabul eder', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    const firstArea = await request(app)
      .post('/api/areas')
      .set('Cookie', cookie)
      .send({ name: 'Salon', sortOrder: 0 });
    const secondArea = await request(app)
      .post('/api/areas')
      .set('Cookie', cookie)
      .send({ name: 'Bahçe', sortOrder: 1 });
    const table = { name: 'Masa 1', capacity: 4, sortOrder: 0 };
    expect(
      (
        await request(app)
          .post('/api/tables')
          .set('Cookie', cookie)
          .send({ ...table, areaId: firstArea.body.area.id })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post('/api/tables')
          .set('Cookie', cookie)
          .send({ ...table, name: 'masa 1', areaId: firstArea.body.area.id })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/api/tables')
          .set('Cookie', cookie)
          .send({ ...table, areaId: secondArea.body.area.id })
      ).status,
    ).toBe(201);
  });

  it('kapasiteyi 1-50 aralığında doğrular', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    const area = await request(app)
      .post('/api/areas')
      .set('Cookie', cookie)
      .send({ name: 'Salon', sortOrder: 0 });
    expect(
      (
        await request(app)
          .post('/api/tables')
          .set('Cookie', cookie)
          .send({ areaId: area.body.area.id, name: 'Masa', capacity: 51, sortOrder: 0 })
      ).status,
    ).toBe(400);
  });

  it('floor plan yalnız aktif masaları doğru sırada döndürür', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    const area = await request(app)
      .post('/api/areas')
      .set('Cookie', cookie)
      .send({ name: 'Salon', sortOrder: 0 });
    const areaId: unknown = area.body.area.id;
    await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ areaId, name: 'Masa 2', capacity: 2, sortOrder: 2 });
    const first = await request(app)
      .post('/api/tables')
      .set('Cookie', cookie)
      .send({ areaId, name: 'Masa 1', capacity: 4, sortOrder: 1 });
    await request(app)
      .patch(`/api/tables/${first.body.table.id}`)
      .set('Cookie', cookie)
      .send({ areaId, name: 'Masa 1', capacity: 4, sortOrder: 1, isActive: false });
    const floor = await request(app).get('/api/floor-plan').set('Cookie', cookie);
    expect(floor.status).toBe(200);
    expect(floor.body.areas[0].tables.map((table: { name: string }) => table.name)).toEqual([
      'Masa 2',
    ]);
  });

  it('geçersiz UUID 400 ve bulunmayan kayıt 404 döndürür', async () => {
    const { app } = createScenario();
    const cookie = await login(app);
    expect(
      (
        await request(app)
          .patch('/api/areas/gecersiz')
          .set('Cookie', cookie)
          .send({ name: 'Salon', sortOrder: 0, isActive: true })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch('/api/areas/00000000-0000-4000-8000-000000000001')
          .set('Cookie', cookie)
          .send({ name: 'Salon', sortOrder: 0, isActive: true })
      ).status,
    ).toBe(404);
  });
});
