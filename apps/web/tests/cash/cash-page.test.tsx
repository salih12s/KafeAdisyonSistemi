import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/app/app';
import {
  recordedRequests,
  renderWithProviders,
  stubAppFetch,
  userForRole,
} from '../helpers/render';

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

describe('Kasa ekranı', () => {
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
