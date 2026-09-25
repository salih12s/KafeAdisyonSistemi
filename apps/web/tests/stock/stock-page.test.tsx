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

describe('Stok ekranı', () => {
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

  it('başka kaleme geçince hareket formu sıfırlanır', async () => {
    const beans = { ...milk, id: 'i2', name: 'Kahve çekirdeği', unit: 'GRAM', isLow: false };
    stubAppFetch({ stockItems: [milk, beans], stockItem: { ...milk, movements: [] } });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/stok');
    const list = await screen.findByRole('list', { name: 'Stok kalemleri' });
    await user.click(within(list).getByRole('button', { name: /Süt/ }));
    const form = await screen.findByRole('form', { name: 'Stok hareketi formu' });
    await user.type(within(form).getByLabelText('Miktar (ml)'), '2000');
    await user.click(within(list).getByRole('button', { name: /Kahve çekirdeği/ }));
    const next = await screen.findByRole('form', { name: 'Stok hareketi formu' });
    expect(within(next).getByLabelText(/Miktar/)).toHaveValue('');
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
