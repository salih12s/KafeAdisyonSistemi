import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { fixture } from '../helpers/operations-fixture';

describe('QR menü (oturumsuz)', () => {
  it('oturum olmadan yalnız aktif ürünü olan kategorileri ve işletme adını döndürür', async () => {
    const input = await fixture();
    const empty = await input.store.createCategory({
      actorUserId: input.owner.id,
      name: 'Boş kategori',
      nameKey: 'boş kategori',
      sortOrder: 1,
      isActive: true,
    });
    const response = await request(input.app).get('/api/public/menu');
    expect(response.status).toBe(200);
    expect(response.body.businessName).toBe('Saydam Cafe');
    expect(response.body.categories.map((category: { id: string }) => category.id)).not.toContain(
      empty.id,
    );
    expect(response.body.categories[0].products[0]).toMatchObject({
      name: 'Latte',
      priceKurus: 12_000,
    });
    expect(response.headers['cache-control']).toContain('max-age=60');
  });

  it('işletmenin telefon ve adresini müşteriye açık künye olarak döndürür', async () => {
    const input = await fixture();
    const before = await request(input.app).get('/api/public/menu');
    expect(before.body).toMatchObject({ phone: null, address: null });

    await input.store.updateBusinessSettings({
      actorUserId: input.owner.id,
      businessName: 'Saydam Cafe',
      phone: '0216 555 00 00',
      address: 'Moda Cad. No: 12, Kadıköy / İstanbul',
    });
    const after = await request(input.app).get('/api/public/menu');
    expect(after.body).toMatchObject({
      businessName: 'Saydam Cafe',
      phone: '0216 555 00 00',
      address: 'Moda Cad. No: 12, Kadıköy / İstanbul',
    });
  });

  it('oturumsuz istek diğer uçlara erişemez', async () => {
    const input = await fixture();
    for (const path of ['/api/menu', '/api/stock/items', '/api/cash/current']) {
      expect((await request(input.app).get(path)).status).toBe(401);
    }
  });
});
