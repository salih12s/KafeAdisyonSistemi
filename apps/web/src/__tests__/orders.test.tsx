import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { recordedRequests, renderWithProviders, stubAppFetch, userForRole } from '../test/render';

const tableId = '00000000-0000-4000-8000-000000000101';
const checkId = '00000000-0000-4000-8000-000000000102';
const productId = '00000000-0000-4000-8000-000000000103';
const categoryId = '00000000-0000-4000-8000-000000000109';
const sizeId = '00000000-0000-4000-8000-000000000104';
const largeId = '00000000-0000-4000-8000-000000000105';
const shotId = '00000000-0000-4000-8000-000000000106';
const itemId = '00000000-0000-4000-8000-000000000107';

const openCheckSummary = {
  id: checkId,
  guestCount: 3,
  openedAt: new Date(Date.now() - 35 * 60_000).toISOString(),
  totalKurus: 18_500,
  discountTotalKurus: 0,
};

function floor(open = true) {
  return {
    areas: [
      {
        id: '00000000-0000-4000-8000-000000000100',
        name: 'Salon',
        sortOrder: 0,
        tables: [
          {
            id: tableId,
            name: 'Masa 1',
            capacity: 4,
            sortOrder: 0,
            openCheck: open ? openCheckSummary : null,
          },
        ],
      },
    ],
  };
}

const check = {
  id: checkId,
  tableId,
  tableName: 'Masa 1',
  openedByUserId: '00000000-0000-4000-8000-000000000001',
  openedByName: 'İşletme Sahibi',
  guestCount: 3,
  status: 'OPEN',
  openedAt: '2026-08-12T09:00:00.000Z',
  totalKurus: 18_500,
  discountTotalKurus: 0,
  paidKurus: 0,
  remainingKurus: 18_500,
  closedAt: null,
  closedByUserId: null,
  closedByName: null,
  payments: [],
  discounts: [],
  mergedIntoCheckId: null,
  items: [
    {
      id: itemId,
      productId,
      productNameSnapshot: 'Latte',
      categoryIdSnapshot: categoryId,
      categoryNameSnapshot: 'Kahveler',
      unitPriceKurusSnapshot: 8000,
      preparationAreaSnapshot: 'BAR',
      preparationStatus: 'SENT',
      quantity: 2,
      note: 'Az sıcak',
      lineTotalKurus: 18_500,
      createdByUserId: '00000000-0000-4000-8000-000000000001',
      createdByName: 'İşletme Sahibi',
      createdAt: '2026-08-12T09:05:00.000Z',
      cancelledAt: null,
      cancellationReason: null,
      cancelledByUserId: null,
      cancelledByName: null,
      complimentaryAt: null,
      complimentaryReason: null,
      complimentaryByUserId: null,
      complimentaryByName: null,
      options: [
        {
          id: '00000000-0000-4000-8000-000000000108',
          optionGroupId: sizeId,
          optionValueId: largeId,
          groupNameSnapshot: 'Boyut',
          valueNameSnapshot: 'Büyük',
          priceDeltaKurusSnapshot: 1000,
        },
      ],
    },
  ],
};

const salesMenu = {
  categories: [
    {
      id: '00000000-0000-4000-8000-000000000109',
      name: 'Kahveler',
      sortOrder: 0,
      products: [
        {
          id: productId,
          name: 'Latte',
          priceKurus: 8000,
          preparationArea: 'BAR',
          sortOrder: 0,
          optionGroups: [
            {
              id: sizeId,
              name: 'Boyut',
              selectionType: 'SINGLE',
              isRequired: true,
              sortOrder: 0,
              values: [{ id: largeId, name: 'Büyük', priceDeltaKurus: 1000, sortOrder: 0 }],
            },
            {
              id: '00000000-0000-4000-8000-000000000110',
              name: 'Ekstralar',
              selectionType: 'MULTIPLE',
              isRequired: false,
              sortOrder: 1,
              values: [{ id: shotId, name: 'Ekstra shot', priceDeltaKurus: 1500, sortOrder: 0 }],
            },
          ],
        },
      ],
    },
  ],
};

describe('Phase 3 masa ve adisyon ekranı', () => {
  it('masa kartında açık/boş durumu, toplam ve açık süreyi gösterir', async () => {
    stubAppFetch({ floorPlan: floor() });
    renderWithProviders(<App />, '/masalar');
    const table = await screen.findByRole('button', { name: /Masa 1/ });
    expect(within(table).getByText('Açık')).toBeInTheDocument();
    expect(within(table).getByText(/185,00/)).toBeInTheDocument();
    expect(within(table).getByText(/35 dk/)).toBeInTheDocument();
  });

  it('boş masayı kişi sayısı ile açar', async () => {
    stubAppFetch({ floorPlan: floor(false), check });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    const form = screen.getByRole('form', { name: 'Masa açma formu' });
    const guests = within(form).getByLabelText('Kişi sayısı');
    await user.clear(guests);
    await user.type(guests, '3');
    await user.click(within(form).getByRole('button', { name: 'Masayı aç' }));
    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: '/api/orders/checks',
        method: 'POST',
        body: { tableId, guestCount: 3 },
      });
    });
  });

  it('açık masadan adisyonu açar ve snapshot kalemleri gösterir', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    expect(await screen.findByText('Masa 1 adisyonu')).toBeInTheDocument();
    expect(screen.getAllByText('Latte')).not.toHaveLength(0);
    expect(screen.getByText(/Boyut: Büyük/)).toBeInTheDocument();
    expect(screen.getByText('Not: Az sıcak')).toBeInTheDocument();
    expect(screen.getAllByText(/185,00/)).not.toHaveLength(0);
  });

  it('ürün seçeneklerini seçerek siparişe ekler', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    await screen.findByText('Masa 1 adisyonu');
    const menuPanel = screen.getByRole('heading', { name: 'Menü' }).closest('section');
    if (menuPanel === null) throw new Error('Menü paneli bulunamadı.');
    await user.click(within(menuPanel).getByRole('button', { name: /Latte/ }));
    const form = screen.getByRole('form', { name: 'Ürün ekleme formu' });
    await user.click(within(form).getByLabelText(/Büyük/));
    await user.click(within(form).getByLabelText(/Ekstra shot/));
    await user.click(within(form).getByRole('button', { name: 'Siparişe ekle' }));
    await waitFor(() => {
      expect(
        recordedRequests.some((entry) => entry.path === `/api/orders/checks/${checkId}/items`),
      ).toBe(true);
    });
    const request = recordedRequests.find((entry) => entry.path.endsWith('/items'));
    expect(request?.body).toMatchObject({
      productId,
      quantity: 1,
      optionValueIds: [largeId, shotId],
    });
  });

  it('zorunlu seçenek tamamlanmadan eklemeyi engeller ve dialog Escape ile kapanır', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    await screen.findByText('Masa 1 adisyonu');
    const menuPanel = screen.getByRole('heading', { name: 'Menü' }).closest('section');
    if (menuPanel === null) throw new Error('Menü paneli bulunamadı.');
    await user.click(within(menuPanel).getByRole('button', { name: /Latte/ }));
    const dialog = screen.getByRole('dialog', { name: 'Latte' });
    expect(within(dialog).getByRole('button', { name: 'Siparişe ekle' })).toBeDisabled();
    expect(within(dialog).getByText(/zorunlu seçenekleri tamamlayın/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Latte' })).not.toBeInTheDocument();
  });

  it('kalemin adet/not güncelleme ve gerekçeli iptal akışlarını sunar', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    await screen.findByText('Masa 1 adisyonu');
    await user.click(screen.getByRole('button', { name: 'Adet / not' }));
    const edit = screen.getByRole('form', { name: 'Latte kalemini düzenle' });
    const quantity = within(edit).getByLabelText('Adet');
    await user.clear(quantity);
    await user.type(quantity, '3');
    await user.click(within(edit).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(recordedRequests.some((entry) => entry.method === 'PATCH')).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Kalemi iptal et' }));
    const cancel = screen.getByRole('form', { name: 'Latte kalemini iptal et' });
    await user.type(within(cancel).getByLabelText('İptal gerekçesi'), 'Müşteri vazgeçti');
    await user.click(within(cancel).getByRole('button', { name: 'İptali onayla' }));
    await waitFor(() => {
      expect(recordedRequests.some((entry) => entry.path.endsWith('/cancel'))).toBe(true);
    });
  });

  it('KITCHEN adisyonu görür fakat mutation kontrollerini görmez', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu, user: userForRole('KITCHEN') });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    expect(await screen.findByText(/Mutfak rolü adisyonu görüntüleyebilir/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adet / not' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kalemi iptal et' })).not.toBeInTheDocument();
  });

  it('nakit ödemede alınan tutarı ve para üstünü gösterip yalnız uygulanan tutarı gönderir', async () => {
    stubAppFetch({ floorPlan: floor(), check, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    const form = await screen.findByRole('form', { name: 'Ödeme alma formu' });
    const amount = within(form).getByLabelText('Ödenecek tutar');
    const received = within(form).getByLabelText('Alınan nakit');
    await user.clear(amount);
    await user.type(amount, '100');
    await user.clear(received);
    await user.type(received, '200');
    expect(within(form).getByText(/100,00/)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Ödeme al' }));
    await waitFor(() =>
      expect(recordedRequests).toContainEqual({
        path: `/api/orders/checks/${checkId}/payments`,
        method: 'POST',
        body: { method: 'CASH', amountKurus: 10_000, cashReceivedKurus: 20_000 },
      }),
    );
  });

  it('kalem ve kişi bazlı hesap bölme kontrollerini sunar', async () => {
    stubAppFetch({
      floorPlan: floor(),
      check,
      salesMenu,
      paymentSplit: {
        mode: 'GUESTS',
        totalKurus: 18_500,
        shares: [
          { label: '1. kişi', amountKurus: 6_167, itemIds: [] },
          { label: '2. kişi', amountKurus: 6_167, itemIds: [] },
          { label: '3. kişi', amountKurus: 6_166, itemIds: [] },
        ],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    await user.click(await screen.findByRole('button', { name: 'Kişiye göre' }));
    await user.click(screen.getByRole('button', { name: 'Payları hesapla' }));
    expect(await screen.findByRole('button', { name: /1\. kişi.*61,67/ })).toBeInTheDocument();
    expect(recordedRequests).toContainEqual({
      path: `/api/orders/checks/${checkId}/payment-split`,
      method: 'POST',
      body: { mode: 'GUESTS' },
    });
    await user.click(screen.getByRole('button', { name: 'Kaleme göre' }));
    expect(screen.getByLabelText(/2 × Latte/)).toBeInTheDocument();
  });

  it('bakiye tamamlanınca hesabı kapatır ve masa görünümüne döner', async () => {
    const settledCheck = {
      ...check,
      paidKurus: check.totalKurus,
      remainingKurus: 0,
      payments: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          method: 'CARD',
          amountKurus: check.totalKurus,
          receivedByUserId: check.openedByUserId,
          receivedByName: check.openedByName,
          createdAt: '2026-08-12T09:30:00.000Z',
        },
      ],
    };
    stubAppFetch({ floorPlan: floor(), check: settledCheck, salesMenu });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    expect(await screen.findByText('Kart · İşletme Sahibi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hesabı kapat' }));
    await waitFor(() =>
      expect(recordedRequests.some((entry) => entry.path.endsWith('/close'))).toBe(true),
    );
    expect(await screen.findByRole('heading', { name: 'Salonlar' })).toBeInTheDocument();
  });

  it('indirim, ikram, cariye aktarma, masa taşıma ve birleştirme isteklerini gönderir', async () => {
    const emptyTableId = '00000000-0000-4000-8000-000000000120';
    const sourceCheckId = '00000000-0000-4000-8000-000000000121';
    const customerId = '00000000-0000-4000-8000-000000000122';
    const operationalFloor = floor();
    operationalFloor.areas[0]?.tables.push(
      {
        id: emptyTableId,
        name: 'Masa 2',
        capacity: 4,
        sortOrder: 1,
        openCheck: null,
      },
      {
        id: '00000000-0000-4000-8000-000000000123',
        name: 'Masa 3',
        capacity: 4,
        sortOrder: 2,
        openCheck: { ...openCheckSummary, id: sourceCheckId },
      },
    );
    const customer = {
      id: customerId,
      name: 'Ayşe Yılmaz',
      phone: null,
      note: null,
      isActive: true,
      balanceKurus: 0,
      createdAt: '2026-08-12T10:00:00.000Z',
      updatedAt: '2026-08-12T10:00:00.000Z',
    };
    stubAppFetch({ floorPlan: operationalFloor, check, salesMenu, customers: [customer] });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/masalar');
    await user.click(await screen.findByRole('button', { name: /Masa 1/ }));
    const discount = await screen.findByRole('form', { name: 'İndirim formu' });
    await user.type(within(discount).getByLabelText('İndirim değeri'), '10');
    await user.type(within(discount).getByLabelText('İndirim gerekçesi'), 'Kampanya');
    await user.click(within(discount).getByRole('button', { name: 'İndirim uygula' }));

    const gift = screen.getByRole('form', { name: 'İkram formu' });
    await user.type(within(gift).getByLabelText('İkram gerekçesi'), 'İşletme ikramı');
    await user.click(within(gift).getByRole('button', { name: 'İkram yap' }));
    await user.click(screen.getByRole('button', { name: 'Kalanı cariye aktar' }));
    await user.click(screen.getByRole('button', { name: 'Masayı taşı' }));
    await user.click(screen.getByRole('button', { name: 'Adisyonları birleştir' }));

    await waitFor(() => expect(recordedRequests).toHaveLength(5));
    expect(recordedRequests).toEqual(
      expect.arrayContaining([
        {
          path: `/api/orders/checks/${checkId}/discounts`,
          method: 'POST',
          body: { type: 'PERCENT', value: 10, reason: 'Kampanya' },
        },
        {
          path: `/api/orders/items/${itemId}/complimentary`,
          method: 'POST',
          body: { reason: 'İşletme ikramı' },
        },
        {
          path: `/api/orders/checks/${checkId}/account-transfer`,
          method: 'POST',
          body: { customerId },
        },
        {
          path: `/api/orders/checks/${checkId}/move`,
          method: 'POST',
          body: { targetTableId: emptyTableId },
        },
        {
          path: `/api/orders/checks/${checkId}/merge`,
          method: 'POST',
          body: { sourceCheckId },
        },
      ]),
    );
  });
});
