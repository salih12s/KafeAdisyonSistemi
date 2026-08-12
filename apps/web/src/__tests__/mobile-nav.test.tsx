import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { NAV_ITEMS } from '../config/navigation';
import { healthyResponse, renderWithProviders, stubHealthFetch } from '../test/render';

describe('Mobil gezinme', () => {
  it('alt çubukta sık kullanılan modülleri gösterir', () => {
    stubHealthFetch(healthyResponse);

    renderWithProviders(<App />);

    const bottomNav = screen.getByRole('navigation', { name: 'Alt gezinme' });

    expect(within(bottomNav).getByRole('link', { name: 'Masalar' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('link', { name: 'Mutfak' })).toBeInTheDocument();
    expect(within(bottomNav).getByRole('button', { name: 'Tümü' })).toBeInTheDocument();
  });

  it('"Tümü" düğmesi tüm modülleri okunabilir biçimde listeler', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    const bottomNav = screen.getByRole('navigation', { name: 'Alt gezinme' });
    await user.click(within(bottomNav).getByRole('button', { name: 'Tümü' }));

    const drawer = screen.getByRole('dialog', { name: 'Tüm modüller' });

    for (const item of NAV_ITEMS) {
      const link = within(drawer).getByRole('link', { name: new RegExp(item.label) });
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent(item.description);
    }
  });

  it('çekmeceden seçilen modüle gidilir ve çekmece kapanır', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    const bottomNav = screen.getByRole('navigation', { name: 'Alt gezinme' });
    await user.click(within(bottomNav).getByRole('button', { name: 'Tümü' }));

    const drawer = screen.getByRole('dialog', { name: 'Tüm modüller' });
    await user.click(within(drawer).getByRole('link', { name: /Cariler/ }));

    expect(screen.getByRole('heading', { level: 1, name: 'Cariler' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Tüm modüller' })).not.toBeInTheDocument();
  });

  it('kapat düğmesi çekmeceyi kapatır', async () => {
    stubHealthFetch(healthyResponse);
    const user = userEvent.setup();

    renderWithProviders(<App />);

    const bottomNav = screen.getByRole('navigation', { name: 'Alt gezinme' });
    await user.click(within(bottomNav).getByRole('button', { name: 'Tümü' }));

    await user.click(screen.getByRole('button', { name: 'Kapat' }));

    expect(screen.queryByRole('dialog', { name: 'Tüm modüller' })).not.toBeInTheDocument();
  });
});
