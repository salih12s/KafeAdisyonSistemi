import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { renderWithProviders, requestedPaths, stubAppFetch, userForRole } from '../test/render';

/** Rapor ekranının varsayılan bitiş tarihiyle aynı hesap (reports-page ile birebir). */
function todayIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const report = {
  range: { from: '2026-08-12', to: '2026-08-12' },
  revenueKurus: 18_500,
  paidCheckCount: 2,
  averageCheckKurus: 9_250,
  paymentDistribution: [
    { method: 'CASH', amountKurus: 5_000 },
    { method: 'CARD', amountKurus: 8_500 },
    { method: 'ACCOUNT', amountKurus: 5_000 },
  ],
  productSales: [{ id: 'p1', name: 'Latte', quantity: 2, totalKurus: 16_000 }],
  categorySales: [{ id: 'c1', name: 'Kahveler', quantity: 2, totalKurus: 16_000 }],
  staffSales: [{ id: 'u1', name: 'Ayşe', quantity: 2, totalKurus: 18_500 }],
  discountTotalKurus: 1_000,
  complimentaryTotalKurus: 8_000,
  cancelledItemCount: 1,
  cancelledItemTotalKurus: 7_500,
  hourlySales: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    totalKurus: hour === 13 ? 18_500 : 0,
  })),
};
const dayEnd = {
  date: '2026-08-12',
  revenueKurus: 18_500,
  cashKurus: 5_000,
  cardKurus: 8_500,
  accountKurus: 5_000,
  openCheckCount: 3,
  openAccountBalanceKurus: 12_000,
  discountTotalKurus: 1_000,
  complimentaryTotalKurus: 8_000,
};

describe('Phase 7 rapor ekranı', () => {
  it('gün sonu ve satış kırılımlarını gerçek API verisiyle gösterir', async () => {
    stubAppFetch({ salesReport: report, dayEnd });
    renderWithProviders(<App />, '/raporlar');
    expect(await screen.findByText('Latte')).toBeInTheDocument();
    expect(screen.getByText('Kahveler')).toBeInTheDocument();
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getAllByText(/185,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Muhasebe\/fiskal Z raporu değildir/)).toBeInTheDocument();
    expect(screen.getByText('13:00')).toBeInTheDocument();
  });

  it('tarih aralığı filtresini API sorgusuna yansıtır', async () => {
    stubAppFetch({ salesReport: report, dayEnd });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/raporlar');
    await screen.findByText('Latte');
    const form = screen.getByRole('form', { name: 'Rapor tarih filtresi' });
    await user.clear(within(form).getByLabelText('Başlangıç'));
    await user.type(within(form).getByLabelText('Başlangıç'), '2026-08-01');
    await user.click(within(form).getByRole('button', { name: 'Raporu getir' }));
    expect(await screen.findByText('Latte')).toBeInTheDocument();
    // Bitiş alanı bugüne göre dolar; sabit tarih yazmak testi ertesi gün kırar.
    expect(requestedPaths).toContain(`/api/reports/sales?from=2026-08-01&to=${todayIstanbul()}`);
  });

  it('WAITER için rapor ekranını göstermeyip 403 ekranına yönlendirir', async () => {
    stubAppFetch({ user: userForRole('WAITER') });
    renderWithProviders(<App />, '/raporlar');
    expect(
      await screen.findByRole('heading', { name: 'Bu bölüme erişim yetkiniz yok' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tarih aralığı')).not.toBeInTheDocument();
  });
});
