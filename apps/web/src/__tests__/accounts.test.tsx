import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { recordedRequests, renderWithProviders, stubAppFetch } from '../test/render';

const customer = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Ayşe Yılmaz',
  phone: '05550000000',
  note: null,
  isActive: true,
  balanceKurus: 7500,
  createdAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-08-12T10:00:00.000Z',
  entries: [
    {
      id: '00000000-0000-4000-8000-000000000602',
      customerId: '00000000-0000-4000-8000-000000000601',
      type: 'DEBT',
      amountKurus: 7500,
      description: 'Adisyon borcu',
      checkId: null,
      actorUserId: '00000000-0000-4000-8000-000000000001',
      actorName: 'İşletme Sahibi',
      createdAt: '2026-08-12T10:00:00.000Z',
    },
  ],
};

describe('Phase 6 cari ekranı', () => {
  it('müşteri arama, bakiye ve ekstreyi gösterir', async () => {
    stubAppFetch({ customers: [customer], customer });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/cariler');
    expect(await screen.findByText('Ayşe Yılmaz')).toBeInTheDocument();
    await user.click(screen.getByText('Ayşe Yılmaz'));
    expect(await screen.findByText(/Adisyon borcu/)).toBeInTheDocument();
    expect(screen.getAllByText(/75,00/).length).toBeGreaterThan(0);
  });
  it('müşteri oluşturur ve tahsilat gönderir', async () => {
    stubAppFetch({ customers: [customer], customer });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/cariler');
    await screen.findByText('Ayşe Yılmaz');
    await user.type(screen.getByLabelText('Ad soyad veya ünvan'), 'Mehmet Kaya');
    await user.click(screen.getByRole('button', { name: 'Müşteri oluştur' }));
    await user.click(screen.getByText('Ayşe Yılmaz'));
    const customerName = await screen.findByLabelText('Müşteri adı');
    await user.clear(customerName);
    await user.type(customerName, 'Ayşe Kaya');
    await user.click(screen.getByRole('button', { name: 'Müşteriyi güncelle' }));
    const amount = await screen.findByLabelText('Tahsilat tutarı');
    await user.type(amount, '25');
    await user.type(screen.getByLabelText('Tahsilat açıklaması'), 'Nakit tahsilat');
    await user.click(screen.getByRole('button', { name: 'Tahsilat gir' }));
    await waitFor(() =>
      expect(recordedRequests.some((r) => r.path.endsWith('/entries') && r.body !== null)).toBe(
        true,
      ),
    );
    expect(recordedRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `/api/accounts/${customer.id}`,
          method: 'PATCH',
          body: expect.objectContaining({ name: 'Ayşe Kaya', isActive: true }),
        }),
      ]),
    );
  });
});
