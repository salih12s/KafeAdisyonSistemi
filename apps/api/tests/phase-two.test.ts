import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { API_ERROR_CODES, type UserRole } from '@kafe/contracts';
import { hashPassword } from '../src/features/password';
import { createTestApp } from './helpers/test-app';
import { MemoryStore } from './helpers/memory-store';

const PASSWORD = 'MenuTest12!';
let passwordHash = '';

beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});

interface Scenario {
  store: MemoryStore;
  app: Express;
  cookie: string;
}

async function createScenario(role: UserRole = 'OWNER'): Promise<Scenario> {
  const store = new MemoryStore();
  store.seedUser({
    fullName: role === 'OWNER' ? 'İşletme Sahibi' : 'Personel',
    username: role.toLowerCase(),
    passwordHash,
    role,
  });
  const app = createTestApp({ databaseConnected: true, store });
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username: role.toLowerCase(), password: PASSWORD });
  expect(response.status).toBe(200);

  const cookies: unknown = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') {
    throw new Error('Oturum çerezi alınamadı.');
  }
  return { store, app, cookie: cookies[0].split(';')[0] ?? '' };
}

async function createCategory(
  scenario: Scenario,
  name: string,
  sortOrder = 0,
): Promise<string> {
  const response = await request(scenario.app)
    .post('/api/menu/categories')
    .set('Cookie', scenario.cookie)
    .send({ name, sortOrder });
  expect(response.status).toBe(201);
  const id: unknown = response.body.category.id;
  if (typeof id !== 'string') throw new Error('Kategori kimliği okunamadı.');
  return id;
}

async function createProduct(
  scenario: Scenario,
  categoryId: string,
  name: string,
  priceKurus = 5500,
): Promise<string> {
  const response = await request(scenario.app)
    .post('/api/menu/products')
    .set('Cookie', scenario.cookie)
    .send({ categoryId, name, priceKurus, preparationArea: 'BAR', sortOrder: 0 });
  expect(response.status).toBe(201);
  const id: unknown = response.body.product.id;
  if (typeof id !== 'string') throw new Error('Ürün kimliği okunamadı.');
  return id;
}

async function createGroup(
  scenario: Scenario,
  productId: string,
  name: string,
  selectionType: 'SINGLE' | 'MULTIPLE' = 'SINGLE',
  isRequired = false,
): Promise<string> {
  const response = await request(scenario.app)
    .post(`/api/menu/products/${productId}/option-groups`)
    .set('Cookie', scenario.cookie)
    .send({ name, selectionType, isRequired, sortOrder: 0 });
  expect(response.status).toBe(201);
  const id: unknown = response.body.optionGroup.id;
  if (typeof id !== 'string') throw new Error('Grup kimliği okunamadı.');
  return id;
}

describe('Menü yetkilendirmesi', () => {
  it('oturum açmamış istek 401 döner', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app).get('/api/menu/categories');
    expect(response.status).toBe(401);
  });

  it('OWNER dışındaki roller menüyü görüntüleyebilir', async () => {
    const scenario = await createScenario('WAITER');
    const response = await request(scenario.app)
      .get('/api/menu/categories')
      .set('Cookie', scenario.cookie);
    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual([]);
  });

  it.each(['CASHIER', 'WAITER', 'KITCHEN'] as const)(
    '%s rolü kategori oluşturamaz',
    async (role) => {
      const scenario = await createScenario(role);
      const response = await request(scenario.app)
        .post('/api/menu/categories')
        .set('Cookie', scenario.cookie)
        .send({ name: 'Sıcak İçecekler', sortOrder: 0 });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(API_ERROR_CODES.FORBIDDEN);
    },
  );

  it('OWNER dışındaki roller ürün ve seçenek de değiştiremez', async () => {
    const owner = await createScenario();
    const categoryId = await createCategory(owner, 'Kahveler');
    const productId = await createProduct(owner, categoryId, 'Latte');

    const waiter = await createScenario('WAITER');
    const productResponse = await request(waiter.app)
      .post('/api/menu/products')
      .set('Cookie', waiter.cookie)
      .send({ categoryId, name: 'Mocha', priceKurus: 6000, preparationArea: 'BAR', sortOrder: 0 });
    expect(productResponse.status).toBe(403);

    const groupResponse = await request(waiter.app)
      .post(`/api/menu/products/${productId}/option-groups`)
      .set('Cookie', waiter.cookie)
      .send({ name: 'Boyut', selectionType: 'SINGLE', isRequired: true, sortOrder: 0 });
    expect(groupResponse.status).toBe(403);
  });
});

describe('Kategoriler', () => {
  it('kategori oluşturur ve audit kaydı bırakır', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app)
      .post('/api/menu/categories')
      .set('Cookie', scenario.cookie)
      .send({ name: '  Sıcak İçecekler  ', sortOrder: 2 });

    expect(response.status).toBe(201);
    expect(response.body.category).toMatchObject({
      name: 'Sıcak İçecekler',
      sortOrder: 2,
      isActive: true,
    });
    expect(scenario.store.audits.some((audit) => audit.action === 'CATEGORY_CREATED')).toBe(true);
  });

  it('aynı kategori adını büyük/küçük harf farkıyla da reddeder', async () => {
    const scenario = await createScenario();
    await createCategory(scenario, 'Tatlılar');

    const response = await request(scenario.app)
      .post('/api/menu/categories')
      .set('Cookie', scenario.cookie)
      .send({ name: 'TATLILAR', sortOrder: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(API_ERROR_CODES.CONFLICT);
  });

  it('düzenlemede başka kategorinin adına çakışmayı reddeder', async () => {
    const scenario = await createScenario();
    await createCategory(scenario, 'Tatlılar');
    const secondId = await createCategory(scenario, 'İçecekler');

    const response = await request(scenario.app)
      .patch(`/api/menu/categories/${secondId}`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Tatlılar', sortOrder: 0, isActive: true });

    expect(response.status).toBe(409);
  });

  it('pasife alınan kategori varsayılan listede görünmez, includeInactive ile görünür', async () => {
    const scenario = await createScenario();
    const id = await createCategory(scenario, 'Mevsimlik');

    const patch = await request(scenario.app)
      .patch(`/api/menu/categories/${id}`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Mevsimlik', sortOrder: 0, isActive: false });
    expect(patch.status).toBe(200);
    expect(patch.body.category.isActive).toBe(false);

    const active = await request(scenario.app)
      .get('/api/menu/categories')
      .set('Cookie', scenario.cookie);
    expect(active.body.categories).toEqual([]);

    const all = await request(scenario.app)
      .get('/api/menu/categories?includeInactive=true')
      .set('Cookie', scenario.cookie);
    expect(all.body.categories).toHaveLength(1);
  });

  it('kategorileri sıra numarasına göre döner', async () => {
    const scenario = await createScenario();
    await createCategory(scenario, 'Tatlılar', 3);
    await createCategory(scenario, 'Kahveler', 1);
    await createCategory(scenario, 'Yiyecekler', 2);

    const response = await request(scenario.app)
      .get('/api/menu/categories')
      .set('Cookie', scenario.cookie);

    expect(response.body.categories.map((entry: { name: string }) => entry.name)).toEqual([
      'Kahveler',
      'Yiyecekler',
      'Tatlılar',
    ]);
  });

  it('boş kategori adını reddeder', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app)
      .post('/api/menu/categories')
      .set('Cookie', scenario.cookie)
      .send({ name: '   ', sortOrder: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });
});

describe('Ürünler', () => {
  it('ürünü kuruş fiyatı ve hazırlık yeriyle oluşturur', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');

    const response = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({
        categoryId,
        name: 'Latte',
        priceKurus: 8500,
        preparationArea: 'BAR',
        sortOrder: 1,
      });

    expect(response.status).toBe(201);
    expect(response.body.product).toMatchObject({
      name: 'Latte',
      priceKurus: 8500,
      preparationArea: 'BAR',
      isActive: true,
    });
    expect(scenario.store.audits.some((audit) => audit.action === 'PRODUCT_CREATED')).toBe(true);
  });

  it('ondalıklı fiyatı reddeder — para tam sayı kuruştur', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');

    const response = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({
        categoryId,
        name: 'Latte',
        priceKurus: 85.5,
        preparationArea: 'BAR',
        sortOrder: 0,
      });

    expect(response.status).toBe(400);
    expect(String(response.body.error.details)).toContain('tam sayı');
  });

  it('negatif fiyatı reddeder', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');

    const response = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({ categoryId, name: 'Latte', priceKurus: -1, preparationArea: 'BAR', sortOrder: 0 });

    expect(response.status).toBe(400);
  });

  it('bilinmeyen hazırlık yerini reddeder', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');

    const response = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({ categoryId, name: 'Latte', priceKurus: 5000, preparationArea: 'GARDEN' });

    expect(response.status).toBe(400);
  });

  it('aynı kategoride aynı ürün adını reddeder, farklı kategoride kabul eder', async () => {
    const scenario = await createScenario();
    const coffees = await createCategory(scenario, 'Kahveler');
    const desserts = await createCategory(scenario, 'Tatlılar');
    await createProduct(scenario, coffees, 'Latte');

    const duplicate = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({ categoryId: coffees, name: 'latte', priceKurus: 9000, preparationArea: 'BAR' });
    expect(duplicate.status).toBe(409);

    const otherCategory = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({ categoryId: desserts, name: 'Latte', priceKurus: 9000, preparationArea: 'KITCHEN' });
    expect(otherCategory.status).toBe(201);
  });

  it('olmayan kategoriye ürün eklemeyi reddeder', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app)
      .post('/api/menu/products')
      .set('Cookie', scenario.cookie)
      .send({
        categoryId: '00000000-0000-4000-8000-000000000999',
        name: 'Latte',
        priceKurus: 5000,
        preparationArea: 'BAR',
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('ürünü satışa kapatır ve fiyatını günceller', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte', 8500);

    const response = await request(scenario.app)
      .patch(`/api/menu/products/${productId}`)
      .set('Cookie', scenario.cookie)
      .send({
        categoryId,
        name: 'Latte',
        priceKurus: 9500,
        preparationArea: 'BAR',
        sortOrder: 0,
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.product).toMatchObject({ priceKurus: 9500, isActive: false });

    const activeOnly = await request(scenario.app)
      .get('/api/menu/products')
      .set('Cookie', scenario.cookie);
    expect(activeOnly.body.products).toEqual([]);
  });
});

describe('Seçenek grupları ve ekstralar', () => {
  it('zorunlu tek seçimli grup ve fiyat farklı seçenekler oluşturur', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');
    const groupId = await createGroup(scenario, productId, 'Boyut', 'SINGLE', true);

    for (const [name, delta] of [
      ['Küçük', -500],
      ['Orta', 0],
      ['Büyük', 750],
    ] as const) {
      const response = await request(scenario.app)
        .post(`/api/menu/option-groups/${groupId}/values`)
        .set('Cookie', scenario.cookie)
        .send({ name, priceDeltaKurus: delta, sortOrder: 0 });
      expect(response.status).toBe(201);
    }

    const groups = await request(scenario.app)
      .get(`/api/menu/products/${productId}/option-groups`)
      .set('Cookie', scenario.cookie);

    expect(groups.status).toBe(200);
    expect(groups.body.optionGroups).toHaveLength(1);
    expect(groups.body.optionGroups[0]).toMatchObject({
      name: 'Boyut',
      selectionType: 'SINGLE',
      isRequired: true,
    });
    expect(groups.body.optionGroups[0].values).toHaveLength(3);
    expect(
      groups.body.optionGroups[0].values.map((value: { priceDeltaKurus: number }) =>
        value.priceDeltaKurus,
      ),
    ).toContain(-500);
  });

  it('çoklu seçimli ekstra grubunu destekler', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');
    const groupId = await createGroup(scenario, productId, 'Ekstralar', 'MULTIPLE', false);

    const response = await request(scenario.app)
      .post(`/api/menu/option-groups/${groupId}/values`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Ekstra shot', priceDeltaKurus: 1500, sortOrder: 0 });

    expect(response.status).toBe(201);
    expect(response.body.optionValue).toMatchObject({
      name: 'Ekstra shot',
      priceDeltaKurus: 1500,
    });
  });

  it('aynı üründe aynı grup adını reddeder', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');
    await createGroup(scenario, productId, 'Süt');

    const response = await request(scenario.app)
      .post(`/api/menu/products/${productId}/option-groups`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'süt', selectionType: 'SINGLE', isRequired: false, sortOrder: 1 });

    expect(response.status).toBe(409);
  });

  it('aynı grupta aynı seçenek adını reddeder', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');
    const groupId = await createGroup(scenario, productId, 'Süt');

    await request(scenario.app)
      .post(`/api/menu/option-groups/${groupId}/values`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Yulaf', priceDeltaKurus: 1000, sortOrder: 0 });

    const response = await request(scenario.app)
      .post(`/api/menu/option-groups/${groupId}/values`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'yulaf', priceDeltaKurus: 1200, sortOrder: 1 });

    expect(response.status).toBe(409);
  });

  it('seçeneği pasife alır ve ondalıklı fiyat farkını reddeder', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');
    const groupId = await createGroup(scenario, productId, 'Süt');

    const created = await request(scenario.app)
      .post(`/api/menu/option-groups/${groupId}/values`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Laktozsuz', priceDeltaKurus: 500, sortOrder: 0 });
    const valueId: unknown = created.body.optionValue.id;
    if (typeof valueId !== 'string') throw new Error('Seçenek kimliği okunamadı.');

    const invalid = await request(scenario.app)
      .patch(`/api/menu/option-values/${valueId}`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Laktozsuz', priceDeltaKurus: 5.5, sortOrder: 0, isActive: true });
    expect(invalid.status).toBe(400);

    const deactivated = await request(scenario.app)
      .patch(`/api/menu/option-values/${valueId}`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Laktozsuz', priceDeltaKurus: 500, sortOrder: 0, isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.optionValue.isActive).toBe(false);

    const groups = await request(scenario.app)
      .get(`/api/menu/products/${productId}/option-groups`)
      .set('Cookie', scenario.cookie);
    expect(groups.body.optionGroups[0].values).toEqual([]);
  });

  it('olmayan ürünün seçeneklerini istemek 404 döner', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app)
      .get('/api/menu/products/00000000-0000-4000-8000-000000000999/option-groups')
      .set('Cookie', scenario.cookie);

    expect(response.status).toBe(404);
  });

  it('geçersiz UUID biçimini 400 ile reddeder', async () => {
    const scenario = await createScenario();
    const response = await request(scenario.app)
      .get('/api/menu/products/gecersiz/option-groups')
      .set('Cookie', scenario.cookie);

    expect(response.status).toBe(400);
  });
});

describe('Satış menüsü görünümü', () => {
  it('yalnız aktif kategori, ürün, grup ve seçenekleri döner', async () => {
    const scenario = await createScenario();
    const coffees = await createCategory(scenario, 'Kahveler', 1);
    const hidden = await createCategory(scenario, 'Gizli', 2);
    await request(scenario.app)
      .patch(`/api/menu/categories/${hidden}`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Gizli', sortOrder: 2, isActive: false });

    const latte = await createProduct(scenario, coffees, 'Latte', 8500);
    const retired = await createProduct(scenario, coffees, 'Eski Ürün', 4000);
    await request(scenario.app)
      .patch(`/api/menu/products/${retired}`)
      .set('Cookie', scenario.cookie)
      .send({
        categoryId: coffees,
        name: 'Eski Ürün',
        priceKurus: 4000,
        preparationArea: 'BAR',
        sortOrder: 0,
        isActive: false,
      });

    const groupId = await createGroup(scenario, latte, 'Boyut', 'SINGLE', true);
    await request(scenario.app)
      .post(`/api/menu/option-groups/${groupId}/values`)
      .set('Cookie', scenario.cookie)
      .send({ name: 'Büyük', priceDeltaKurus: 750, sortOrder: 0 });

    const response = await request(scenario.app).get('/api/menu').set('Cookie', scenario.cookie);

    expect(response.status).toBe(200);
    expect(response.body.categories).toHaveLength(1);
    expect(response.body.categories[0].name).toBe('Kahveler');
    expect(response.body.categories[0].products).toHaveLength(1);
    expect(response.body.categories[0].products[0]).toMatchObject({
      name: 'Latte',
      priceKurus: 8500,
    });
    expect(response.body.categories[0].products[0].optionGroups[0].values[0]).toMatchObject({
      name: 'Büyük',
      priceDeltaKurus: 750,
    });
  });

  it('menü görünümünü personel rolleri de okuyabilir', async () => {
    const scenario = await createScenario('KITCHEN');
    const response = await request(scenario.app).get('/api/menu').set('Cookie', scenario.cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ categories: [] });
  });
});

describe('Silme uçları tanımlı değildir', () => {
  it('kategori DELETE isteği 404 döner — kayıtlar pasife alınır', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');

    const response = await request(scenario.app)
      .delete(`/api/menu/categories/${categoryId}`)
      .set('Cookie', scenario.cookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('ürün DELETE isteği 404 döner', async () => {
    const scenario = await createScenario();
    const categoryId = await createCategory(scenario, 'Kahveler');
    const productId = await createProduct(scenario, categoryId, 'Latte');

    const response = await request(scenario.app)
      .delete(`/api/menu/products/${productId}`)
      .set('Cookie', scenario.cookie);

    expect(response.status).toBe(404);
  });
});
