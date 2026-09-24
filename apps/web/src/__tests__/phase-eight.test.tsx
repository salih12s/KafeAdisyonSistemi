import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { shiftIsoDate, todayIstanbul } from '../lib/datetime';
import {
  recordedRequests,
  renderWithProviders,
  requestedPaths,
  stubAppFetch,
  userForRole,
} from '../test/render';

const openSession = {
  id: 's1',
  status: 'OPEN',
  openedAt: '2026-08-12T06:00:00.000Z',
  openedByName: 'Mustafa',
  openingCashKurus: 50_000,
  cashSalesKurus: 24_000,
  cashInKurus: 10_000,
  cashOutKurus: 4_000,
  expectedCashKurus: 80_000,
  countedCashKurus: null,
  differenceKurus: null,
  closedAt: null,
  closedByName: null,
  openingNote: null,
  closingNote: null,
  movements: [
    {
      id: 'm1',
      type: 'OUT',
      amountKurus: 4_000,
      reason: 'Süt alımı',
      actorName: 'Mustafa',
      createdAt: '2026-08-12T08:00:00.000Z',
    },
  ],
};

const milk = {
  id: 'i1',
  name: 'Süt',
  unit: 'MILLILITER',
  balance: 800,
  lowStockThreshold: 1_000,
  isLow: true,
  isActive: true,
  createdAt: '2026-08-12T06:00:00.000Z',
  updatedAt: '2026-08-12T06:00:00.000Z',
};

describe('Phase 8 kasa ekranı', () => {
  it('kasa kapalıyken açılış tutarını kuruşa çevirip gönderir', async () => {
    stubAppFetch({ cashSession: null, cashSessionAfterWrite: openSession });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/kasa');

    const form = await screen.findByRole('form', { name: 'Kasa açılış formu' });
    await user.type(within(form).getByLabelText('Açılış nakdi (₺)'), '500,00');
    await user.click(within(form).getByRole('button', { name: 'Kasayı aç' }));

    expect(await screen.findByLabelText('Beklenen nakit')).toHaveTextContent('800,00');
    expect(recordedRequests).toContainEqual({
      path: '/api/cash/open',
      method: 'POST',
      body: { openingCashKurus: 50_000, note: null },
    });
  });

  it('geçersiz tutarı göndermeden hata gösterir', async () => {
    stubAppFetch({ cashSession: null });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/kasa');
    const form = await screen.findByRole('form', { name: 'Kasa açılış formu' });
    await user.type(within(form).getByLabelText('Açılış nakdi (₺)'), 'beş yüz');
    await user.click(within(form).getByRole('button', { name: 'Kasayı aç' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('125,50');
    expect(recordedRequests).toEqual([]);
  });

  it('açık kasada beklenen dökümü ve kapanış öncesi sayım farkını gösterir', async () => {
    stubAppFetch({ cashSession: openSession });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/kasa');

    expect(await screen.findByLabelText('Beklenen nakit')).toHaveTextContent('800,00');
    expect(screen.getByText('Süt alımı')).toBeInTheDocument();
    const close = screen.getByRole('form', { name: 'Kasa kapanış formu' });
    await user.type(within(close).getByLabelText('Sayılan nakit (₺)'), '795');
    expect(within(close).getByText(/5,00.*eksik/)).toBeInTheDocument();
    await user.click(within(close).getByRole('button', { name: 'Kasayı kapat' }));
    await waitFor(() =>
      expect(recordedRequests).toContainEqual({
        path: '/api/cash/current/close',
        method: 'POST',
        body: { countedCashKurus: 79_500, note: null },
      }),
    );
  });

  it('garson kasa ve stok ekranlarına giremez, menüde de görmez', async () => {
    stubAppFetch({ user: userForRole('WAITER') });
    renderWithProviders(<App />, '/kasa');
    expect(await screen.findByText(/yetkiniz yok/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Kasa/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Stok/ })).not.toBeInTheDocument();
  });
});

describe('Phase 8 stok ekranı', () => {
  it('azalan stoğu işaretler, alım hareketini tam sayı miktarla gönderir', async () => {
    stubAppFetch({ stockItems: [milk], stockItem: { ...milk, movements: [] } });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/stok');

    const list = await screen.findByRole('list', { name: 'Stok kalemleri' });
    expect(within(list).getByText('Azaldı')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: /Süt/ }));
    expect(await screen.findByLabelText('Güncel stok')).toHaveTextContent('800 ml');

    const form = screen.getByRole('form', { name: 'Stok hareketi formu' });
    await user.type(within(form).getByLabelText('Miktar (ml)'), '1000');
    await user.click(within(form).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(recordedRequests).toContainEqual({
        path: '/api/stock/items/i1/movements',
        method: 'POST',
        body: { type: 'PURCHASE', quantity: 1000, reason: null },
      }),
    );
  });

  it('sayım düzeltmesinde sayılan miktarı gönderir', async () => {
    stubAppFetch({ stockItems: [milk], stockItem: { ...milk, movements: [] } });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/stok');
    await user.click(await screen.findByRole('button', { name: /Süt/ }));
    const form = await screen.findByRole('form', { name: 'Stok hareketi formu' });
    await user.click(within(form).getByRole('button', { name: 'Sayım düzeltmesi' }));
    await user.type(within(form).getByLabelText('Sayılan miktar (ml)'), '650');
    await user.type(within(form).getByLabelText(/Açıklama/), 'Akşam sayımı');
    await user.click(within(form).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() =>
      expect(recordedRequests).toContainEqual({
        path: '/api/stock/items/i1/movements',
        method: 'POST',
        body: { type: 'ADJUSTMENT', countedQuantity: 650, reason: 'Akşam sayımı' },
      }),
    );
  });

  it('kasiyer stok kalemi ekleyemez ve reçeteyi düzenleyemez', async () => {
    stubAppFetch({ user: userForRole('CASHIER'), stockItems: [milk] });
    renderWithProviders(<App />, '/stok');
    await screen.findByRole('list', { name: 'Stok kalemleri' });
    expect(screen.queryByRole('button', { name: 'Stok kalemi ekle' })).not.toBeInTheDocument();
  });

  it('özet ekranında azalan stoğu listeler', async () => {
    stubAppFetch({ stockItems: [milk], cashSession: null });
    renderWithProviders(<App />);
    const lowStock = await screen.findByRole('list', { name: 'Azalan stoklar' });
    expect(within(lowStock).getByText('Süt')).toBeInTheDocument();
    expect(await screen.findByText('Kasa kapalı')).toBeInTheDocument();
  });
});

describe('Phase 8 QR menü', () => {
  it('oturum olmadan menüyü ve fiyatları gösterir, girişe yönlendirmez', async () => {
    stubAppFetch({
      user: null,
      publicMenu: {
        businessName: 'Joker Cafe',
        categories: [
          {
            id: 'c1',
            name: 'Kahveler',
            sortOrder: 0,
            products: [
              {
                id: 'p1',
                name: 'Latte',
                priceKurus: 12_000,
                preparationArea: 'BAR',
                sortOrder: 0,
                optionGroups: [
                  {
                    id: 'g1',
                    name: 'Süt',
                    selectionType: 'SINGLE',
                    isRequired: true,
                    sortOrder: 0,
                    values: [
                      { id: 'v1', name: 'Tam yağlı', priceDeltaKurus: 0, sortOrder: 0 },
                      { id: 'v2', name: 'Yulaf', priceDeltaKurus: 1_500, sortOrder: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    renderWithProviders(<App />, '/qr-menu');
    expect(await screen.findByRole('heading', { name: 'Joker Cafe' })).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.getByText(/120,00/)).toBeInTheDocument();
    // tr-TR para biçimi sembolü sayının önüne koyar: "+₺15,00".
    expect(screen.getByText('Süt:').parentElement).toHaveTextContent(/Yulaf \+₺\s?15,00/);
    expect(screen.queryByText('Personel girişi')).not.toBeInTheDocument();
    expect(requestedPaths).not.toContain('/api/auth/me');
  });

  it('ayarlarda yazdırılabilir QR kodu ve deneme fişi sunar', async () => {
    stubAppFetch();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'Yazıcı ve QR Menü' }));
    expect(screen.getByRole('img', { name: 'QR menü kodu' })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/qr-menu`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '58 mm' }));
    await user.click(screen.getByRole('button', { name: 'Deneme fişi yazdır' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.print-sheet')?.getAttribute('data-paper')).toBe('58');
  });
});

describe('Phase 8 grafikli rapor', () => {
  it('günlük ciro grafiğini, en yüksek günü ve tablo görünümünü gösterir', async () => {
    stubAppFetch({
      salesReport: {
        range: { from: '2026-08-11', to: '2026-08-12' },
        revenueKurus: 24_500,
        paidCheckCount: 3,
        averageCheckKurus: 8_167,
        paymentDistribution: [],
        productSales: [],
        categorySales: [],
        staffSales: [],
        discountTotalKurus: 0,
        complimentaryTotalKurus: 0,
        cancelledItemCount: 0,
        cancelledItemTotalKurus: 0,
        hourlySales: [],
        dailySales: [
          { date: '2026-08-11', totalKurus: 6_000, checkCount: 1 },
          { date: '2026-08-12', totalKurus: 18_500, checkCount: 2 },
        ],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/raporlar');
    const columns = await screen.findByRole('list', { name: 'Günlük ciro sütunları' });
    const peak = within(columns).getByRole('button', { name: /12 Ağu.*185,00.*2 adisyon/ });
    await user.hover(peak);
    expect(await screen.findByRole('status')).toHaveTextContent('185,00');
    expect(screen.getByText(/En yüksek gün/)).toHaveTextContent('12 Ağu');
    expect(screen.getByText('Tablo olarak göster')).toBeInTheDocument();
  });

  it('"Son 7 gün" ön ayarı raporu bugünden geriye 7 günlük aralıkla ister', async () => {
    stubAppFetch();
    const user = userEvent.setup();
    renderWithProviders(<App />, '/raporlar');
    await user.click(await screen.findByRole('button', { name: 'Son 7 gün' }));
    const today = todayIstanbul();
    await waitFor(() =>
      expect(requestedPaths).toContain(
        `/api/reports/sales?from=${shiftIsoDate(today, -6)}&to=${today}`,
      ),
    );
  });
});
