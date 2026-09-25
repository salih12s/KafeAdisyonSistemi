import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { saleConsumption } from '../../src/modules/stock/stock-calculations';
import { fixture, sellAndClose } from '../helpers/operations-fixture';

describe('Stok ve reçete', () => {
  it('reçeteye göre kapanan adisyondan stok düşer; iptal edilen kalem düşmez', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Süt', unit: 'MILLILITER', lowStockThreshold: 1_000 });
    expect(created.status).toBe(201);
    const milkId: string = created.body.item.id;

    await request(input.app)
      .post(`/api/stock/items/${milkId}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 5_000, reason: 'Tedarikçi' })
      .expect(201);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: milkId, quantityPerUnit: 200 }] });
    expect(recipe.body.recipe.lines).toEqual([
      { stockItemId: milkId, stockItemName: 'Süt', unit: 'MILLILITER', quantityPerUnit: 200 },
    ]);

    await sellAndClose(input, 3, true);

    const detail = await request(input.app)
      .get(`/api/stock/items/${milkId}`)
      .set('Cookie', input.cookie);
    // 5000 − 3 × 200 = 4400; iptal edilen 5 adet düşülmez.
    expect(detail.body.item).toMatchObject({ balance: 4_400, isLow: false });
    expect(detail.body.item.movements[0]).toMatchObject({ type: 'SALE', quantityDelta: -600 });
  });

  it('sayım düzeltmesi farkı yazar, fire düşer ve eşik altı stok isLow olur', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Kahve çekirdeği', unit: 'GRAM', lowStockThreshold: 500 });
    const id: string = created.body.item.id;
    await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 1_000 })
      .expect(201);
    await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'WASTE', quantity: 100, reason: 'Döküldü' })
      .expect(201);
    const adjusted = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'ADJUSTMENT', countedQuantity: 450, reason: 'Akşam sayımı' });
    expect(adjusted.body.item).toMatchObject({ balance: 450, isLow: true });
    expect(adjusted.body.item.movements[0]).toMatchObject({
      type: 'ADJUSTMENT',
      quantityDelta: -450,
    });

    const same = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'ADJUSTMENT', countedQuantity: 450, reason: 'Tekrar sayım' });
    expect(same.status).toBe(400);
    const sale = await request(input.app)
      .post(`/api/stock/items/${id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'SALE', quantity: 10 });
    expect(sale.status).toBe(400);
  });

  it('aynı adla ikinci stok kalemini ve reçetede tekrar eden kalemi reddeder', async () => {
    const input = await fixture();
    const body = { name: 'Şeker', unit: 'GRAM', lowStockThreshold: 0 };
    const first = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send(body);
    const duplicate = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ ...body, name: 'ŞEKER' });
    expect(duplicate.status).toBe(409);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({
        lines: [
          { stockItemId: first.body.item.id, quantityPerUnit: 5 },
          { stockItemId: first.body.item.id, quantityPerUnit: 10 },
        ],
      });
    expect(recipe.status).toBe(400);

    const tooLarge = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: first.body.item.id, quantityPerUnit: 100_001 }] });
    expect(tooLarge.status).toBe(400);
  });

  it('reçeteden çıkarılan satırı pasife alır, sonraki satışta düşmez', async () => {
    const input = await fixture();
    const created = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Bardak', unit: 'PIECE', lowStockThreshold: 0 });
    const id: string = created.body.item.id;
    await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [{ stockItemId: id, quantityPerUnit: 1 }] })
      .expect(200);
    const cleared = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [] });
    expect(cleared.body.recipe.lines).toEqual([]);
    await sellAndClose(input, 2);
    const detail = await request(input.app)
      .get(`/api/stock/items/${id}`)
      .set('Cookie', input.cookie);
    expect(detail.body.item.balance).toBe(0);
  });

  it('kasiyer stok hareketi girer ama stok kalemi ve reçete tanımlayamaz; garson stoğu göremez', async () => {
    const input = await fixture('CASHIER');
    const item = await input.store.createStockItem({
      actorUserId: input.owner.id,
      name: 'Çay',
      nameKey: 'çay',
      unit: 'GRAM',
      lowStockThreshold: 0,
      isActive: true,
    });
    const movement = await request(input.app)
      .post(`/api/stock/items/${item.id}/movements`)
      .set('Cookie', input.cookie)
      .send({ type: 'PURCHASE', quantity: 250 });
    expect(movement.status).toBe(201);
    const create = await request(input.app)
      .post('/api/stock/items')
      .set('Cookie', input.cookie)
      .send({ name: 'Limon', unit: 'PIECE', lowStockThreshold: 0 });
    expect(create.status).toBe(403);
    const recipe = await request(input.app)
      .put(`/api/stock/recipes/${input.product.id}`)
      .set('Cookie', input.cookie)
      .send({ lines: [] });
    expect(recipe.status).toBe(403);

    const waiter = await fixture('WAITER');
    const list = await request(waiter.app).get('/api/stock/items').set('Cookie', waiter.cookie);
    expect(list.status).toBe(403);
  });

  it('satış tüketimini ürün bazında toplar ve iptalleri dışarıda bırakır', () => {
    const consumption = saleConsumption(
      [
        { productId: 'latte', quantity: 2, cancelled: false },
        { productId: 'latte', quantity: 1, cancelled: false },
        { productId: 'latte', quantity: 4, cancelled: true },
        { productId: 'mocha', quantity: 1, cancelled: false },
      ],
      [
        { productId: 'latte', stockItemId: 'milk', quantityPerUnit: 200 },
        { productId: 'mocha', stockItemId: 'milk', quantityPerUnit: 150 },
        { productId: 'mocha', stockItemId: 'chocolate', quantityPerUnit: 30 },
      ],
    );
    expect(Object.fromEntries(consumption)).toEqual({ milk: 750, chocolate: 30 });
  });
});
