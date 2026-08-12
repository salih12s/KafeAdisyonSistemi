import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { renderWithProviders, stubAppFetch, userForRole } from '../test/render';

describe('Frontend authentication', () => {
  it('setup yapılmadığında terminal komutunu ve login formunu gösterir', async () => {
    stubAppFetch({ user: null, initialized: false });
    renderWithProviders(<App />, '/login');

    expect(await screen.findByRole('heading', { name: 'Kafe Adisyon' })).toBeInTheDocument();
    expect(await screen.findByText(/npm run setup:owner/)).toBeInTheDocument();
    expect(screen.getByLabelText('Kullanıcı adı')).toBeInTheDocument();
    expect(screen.getByLabelText('Şifre')).toHaveAttribute('type', 'password');
  });

  it('başarılı login sonrası korumalı uygulamaya gider', async () => {
    stubAppFetch({ user: null, initialized: true });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/login');

    await user.type(await screen.findByLabelText('Kullanıcı adı'), 'owner');
    await user.type(screen.getByLabelText('Şifre'), 'OwnerTest12!');
    await user.click(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Özet' })).toBeInTheDocument();
  });

  it('hatalı login genel mesajını gösterir', async () => {
    stubAppFetch({ user: null, loginError: 'Kullanıcı adı veya şifre hatalı.' });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/login');

    await user.type(await screen.findByLabelText('Kullanıcı adı'), 'owner');
    await user.type(screen.getByLabelText('Şifre'), 'YanlisTest12!');
    await user.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kullanıcı adı veya şifre hatalı.');
  });

  it('giriş yapılmadan protected route login ekranına yönlenir', async () => {
    stubAppFetch({ user: null });
    renderWithProviders(<App />, '/masalar');
    expect(await screen.findByText('Personel girişi')).toBeInTheDocument();
  });

  it('session yüklenirken protected içerik göstermez', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') return new Promise(() => undefined);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ initialized: true }),
        });
      }),
    );
    renderWithProviders(<App />);
    expect(screen.getByText('Oturum kontrol ediliyor…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Özet' })).not.toBeInTheDocument();
  });

  it('owner Ayarlar bağlantısını görür, non-owner görmez ve URL erişimi engellenir', async () => {
    stubAppFetch();
    const ownerView = renderWithProviders(<App />);
    const ownerNav = await screen.findByRole('navigation', { name: 'Ana menü' });
    expect(within(ownerNav).getByRole('link', { name: 'Ayarlar' })).toBeInTheDocument();
    ownerView.unmount();

    stubAppFetch({ user: userForRole('WAITER') });
    renderWithProviders(<App />, '/ayarlar');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Özet' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link', { name: 'Ayarlar' })).not.toBeInTheDocument();
  });

  it('çıkış yapınca login ekranına döner', async () => {
    stubAppFetch();
    const user = userEvent.setup();
    renderWithProviders(<App />);
    await user.click(await screen.findByRole('button', { name: 'Çıkış' }));
    expect(await screen.findByText('Personel girişi')).toBeInTheDocument();
  });
});
