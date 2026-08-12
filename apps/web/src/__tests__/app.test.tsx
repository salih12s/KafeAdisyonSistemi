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

function mainNav(): Promise<HTMLElement> {
  return screen.findByRole('navigation', { name: 'Ana menü' });
}

describe('Uygulama kabuğu', () => {
  it('açılış ekranını ve ana gezinmeyi gösterir', async () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Özet' })).toBeInTheDocument();

    const nav = await mainNav();

    for (const label of ['Özet', 'Masalar', 'Menü', 'Mutfak', 'Cariler', 'Raporlar', 'Ayarlar']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('gezinme bağlantısına tıklandığında ilgili modül açılır', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    await user.click(within(await mainNav()).getByRole('link', { name: 'Masalar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Masalar' })).toBeInTheDocument();
    expect(await screen.findByText('Henüz salon veya masa tanımlanmadı')).toBeInTheDocument();

    await user.click(within(await mainNav()).getByRole('link', { name: 'Raporlar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Raporlar' })).toBeInTheDocument();
    expect(screen.getByText('Tarih aralığı')).toBeInTheDocument();
  });

  it('bağlantı sağlıklıyken sistemin hazır olduğunu bildirir', async () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Sistem hazır');
    });

    expect(screen.getByText('Sistem çevrimiçi')).toBeInTheDocument();
  });

  it('veritabanı bağlantısı yokken anlaşılır Türkçe uyarı gösterir', async () => {
    stubHealthFetch(degradedResponse, 503);

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('health-indicator')).toHaveTextContent('Veritabanı yok');
    });

    expect(
      screen.getByText(/Sunucu açık ancak PostgreSQL bağlantısı kurulamıyor/),
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

  it('tanımsız adres için bulunamadı sayfası gösterilir', async () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />, '/olmayan-sayfa');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sayfa bulunamadı' }),
    ).toBeInTheDocument();
  });
});
