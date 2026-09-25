import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/app';
import { shiftIsoDate, todayIstanbul } from '../../src/shared/lib/datetime';
import { renderWithProviders, requestedPaths, stubAppFetch } from '../helpers/render';

describe('Günlük ciro grafiği', () => {
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
