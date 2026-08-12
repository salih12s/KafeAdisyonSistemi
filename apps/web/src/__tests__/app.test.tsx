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
  });

  it('gezinme bağlantısına tıklandığında ilgili modül açılır', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    await user.click(within(mainNav()).getByRole('link', { name: 'Masalar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Masalar' })).toBeInTheDocument();
    expect(screen.getByText('Henüz salon veya masa tanımlanmadı')).toBeInTheDocument();

    await user.click(within(mainNav()).getByRole('link', { name: 'Raporlar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Raporlar' })).toBeInTheDocument();
    expect(screen.getByText('Raporlanacak satış verisi yok')).toBeInTheDocument();
  });

  it('bağlantı sağlıklıyken sistemin hazır olduğunu bildirir', async () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Sistem hazır');
    });

    expect(screen.getByText('Veritabanı bağlantısı aktif')).toBeInTheDocument();
  });

  it('veritabanı bağlantısı yokken anlaşılır Türkçe uyarı gösterir', async () => {
    stubHealthFetch(degradedResponse, 503);

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Veritabanı yok');
    });

    expect(screen.getByText('Bağlantı yok')).toBeInTheDocument();
    expect(
      screen.getByText(/Sunucu çalışıyor ancak veritabanına bağlanılamıyor/),
    ).toBeInTheDocument();
  });

  it('sunucuya ulaşılamadığında stack trace yerine anlaşılır mesaj gösterir', async () => {
    stubFailingFetch();

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Sunucu yok');
    });

    const warning = screen.getByText(/API sunucusuna ulaşılamıyor/);

    expect(warning).toBeInTheDocument();
    expect(warning.textContent).not.toContain('Error');
    expect(warning.textContent).not.toContain('at ');
  });

  it('tanımsız adres için bulunamadı sayfası gösterilir', () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />, '/olmayan-sayfa');

    expect(screen.getByRole('heading', { level: 2, name: 'Sayfa bulunamadı' })).toBeInTheDocument();
  });
});
