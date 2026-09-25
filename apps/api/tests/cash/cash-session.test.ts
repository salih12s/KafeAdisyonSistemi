import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { fixture, sellAndClose } from '../helpers/operations-fixture';

describe('Kasa oturumu', () => {
  it('açılış, nakit satış, giriş/çıkış ve kapanışta beklenen tutarı ve farkı hesaplar', async () => {
    const input = await fixture('CASHIER');
    const opened = await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 50_000, note: 'Sabah' });
    expect(opened.status).toBe(201);
    expect(opened.body.session).toMatchObject({ status: 'OPEN', expectedCashKurus: 50_000 });

    const sale = await sellAndClose(input, 2);
    expect(sale).toBe(24_000);

    await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'IN', amountKurus: 10_000, reason: 'Bozuk para' })
      .expect(201);
    const out = await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'OUT', amountKurus: 4_000, reason: 'Süt alımı' });
    expect(out.body.session).toMatchObject({
      cashSalesKurus: 24_000,
      cashInKurus: 10_000,
      cashOutKurus: 4_000,
      expectedCashKurus: 80_000,
    });

    const closed = await request(input.app)
      .post('/api/cash/current/close')
      .set('Cookie', input.cookie)
      .send({ countedCashKurus: 79_500, note: null });
    expect(closed.status).toBe(200);
    expect(closed.body.session).toMatchObject({
      status: 'CLOSED',
      expectedCashKurus: 80_000,
      countedCashKurus: 79_500,
      differenceKurus: -500,
    });

    const current = await request(input.app).get('/api/cash/current').set('Cookie', input.cookie);
    expect(current.body.session).toBeNull();
    const history = await request(input.app).get('/api/cash/sessions').set('Cookie', input.cookie);
    expect(history.body.sessions).toHaveLength(1);
    // Kapanmış kasanın dökümü sabit beklenen tutarla tutarlıdır.
    expect(history.body.sessions[0]).toMatchObject({
      cashSalesKurus: 24_000,
      expectedCashKurus: 80_000,
      differenceKurus: -500,
    });
    expect(input.store.audits.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['CASH_SESSION_OPENED', 'CASH_MOVEMENT_ADDED', 'CASH_SESSION_CLOSED']),
    );
  });

  it('gelecek zaman damgalı nakit ödemeyi açık kasa önizlemesine ve kapanışa katmaz', async () => {
    const input = await fixture();
    await input.store.openCashSession({
      actorUserId: input.owner.id,
      openingCashKurus: 50_000,
      note: null,
    });
    const check = await input.store.openCheck({
      actorUserId: input.owner.id,
      tableId: input.table.id,
      guestCount: 1,
    });
    await input.store.addOrderItem({
      actorUserId: input.owner.id,
      checkId: check.id,
      productId: input.product.id,
      quantity: 1,
      note: null,
      optionValueIds: [],
    });

    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now + 60_000);
    try {
      await input.store.addPayment({
        actorUserId: input.owner.id,
        checkId: check.id,
        method: 'CASH',
        amountKurus: 12_000,
        cashReceivedKurus: 12_000,
      });
    } finally {
      vi.useRealTimers();
    }

    expect(await input.store.getCurrentCashSession()).toMatchObject({
      cashSalesKurus: 0,
      expectedCashKurus: 50_000,
    });
    expect(
      await input.store.closeCashSession({
        actorUserId: input.owner.id,
        countedCashKurus: 50_000,
        note: null,
      }),
    ).toMatchObject({ expectedCashKurus: 50_000, differenceKurus: 0 });
  });

  it('ikinci açık kasayı, açık kasa yokken hareketi ve geçersiz tutarı reddeder', async () => {
    const input = await fixture();
    const noSession = await request(input.app)
      .post('/api/cash/current/movements')
      .set('Cookie', input.cookie)
      .send({ type: 'IN', amountKurus: 100, reason: 'Deneme' });
    expect(noSession.status).toBe(409);

    await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 0 })
      .expect(201);
    const second = await request(input.app)
      .post('/api/cash/open')
      .set('Cookie', input.cookie)
      .send({ openingCashKurus: 0 });
    expect(second.status).toBe(409);

    for (const body of [
      { type: 'IN', amountKurus: 0, reason: 'Sıfır' },
      { type: 'OUT', amountKurus: 10.5, reason: 'Kesirli' },
      { type: 'OUT', amountKurus: 100, reason: '' },
    ]) {
      const invalid = await request(input.app)
        .post('/api/cash/current/movements')
        .set('Cookie', input.cookie)
        .send(body);
      expect(invalid.status).toBe(400);
    }
  });

  it('garson ve mutfak kasaya erişemez', async () => {
    for (const role of ['WAITER', 'KITCHEN'] as const) {
      const input = await fixture(role);
      const response = await request(input.app)
        .get('/api/cash/current')
        .set('Cookie', input.cookie);
      expect(response.status).toBe(403);
    }
  });
});
