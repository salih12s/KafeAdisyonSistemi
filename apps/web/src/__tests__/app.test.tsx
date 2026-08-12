import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import {
  degradedResponse,
  healthyResponse,
  renderWithProviders,
  stubFailingFetch,
  stubHealthFetch,
} from '../test/render';

function mainNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Ana menü' });
}

describe('Uygulama kabuğu', () => {
  it('açılış ekranını ve ana gezinmeyi gösterir', async () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Özet' })).toBeInTheDocument();

    const nav = mainNav();

    for (const label of ['Özet', 'Masalar', 'Menü', 'Mutfak', 'Cariler', 'Raporlar', 'Ayarlar']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Bağlı');
    });
  });

  it('gezinme bağlantısına tıklandığında ilgili modül açılır', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    await user.click(within(mainNav()).getByRole('link', { name: 'Masalar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Masalar' })).toBeInTheDocument();
    expect(screen.getByText('Henüz salon ve masa tanımlanmadı')).toBeInTheDocument();

    await user.click(within(mainNav()).getByRole('link', { name: 'Raporlar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Raporlar' })).toBeInTheDocument();
    expect(screen.getByText('Raporlanacak satış verisi yok')).toBeInTheDocument();
  });

  it('veritabanı bağlantısı yokken durumu açıkça bildirir', async () => {
    stubHealthFetch(degradedResponse, 503);

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Veritabanı yok');
    });

    expect(screen.getByText('Bağlantı yok')).toBeInTheDocument();
  });

  it('sunucuya ulaşılamadığında uyarı gösterir', async () => {
    stubFailingFetch();

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Sunucu yok');
    });

    expect(
      screen.getByText(/API sunucusuna ulaşılamıyor\. Kasa bilgisayarında/),
    ).toBeInTheDocument();
  });

  it('tanımsız adres için bulunamadı sayfası gösterilir', () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />, '/olmayan-sayfa');

    expect(screen.getByRole('heading', { level: 2, name: 'Sayfa bulunamadı' })).toBeInTheDocument();
  });
});
