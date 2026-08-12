import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { renderWithProviders, stubAppFetch } from '../test/render';

describe('Phase 7 işlem geçmişi', () => {
  it('OWNER güvenli metadata ile salt okunur audit kayıtlarını filtreler', async () => {
    stubAppFetch({
      staff: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          fullName: 'İşletme Sahibi',
          username: 'owner',
          role: 'OWNER',
          isActive: true,
          lastLoginAt: null,
          createdAt: '2026-08-12T08:00:00Z',
          updatedAt: '2026-08-12T08:00:00Z',
        },
      ],
      audit: {
        entries: [
          {
            id: 'a1',
            actorUserId: '00000000-0000-4000-8000-000000000001',
            actorName: 'İşletme Sahibi',
            action: 'PAYMENT_RECEIVED',
            entityType: 'Payment',
            entityId: 'payment-1',
            metadata: { amountKurus: 5000, method: 'CASH' },
            createdAt: '2026-08-12T10:00:00Z',
          },
        ],
        actions: ['PAYMENT_RECEIVED'],
        entityTypes: ['Payment'],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/ayarlar');
    await user.click(await screen.findByRole('button', { name: 'İşlem Geçmişi' }));
    expect((await screen.findAllByText('PAYMENT_RECEIVED')).length).toBeGreaterThan(0);
    expect(screen.getByText(/amountKurus: 5000/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sil|değiştir/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filtrele' }));
    expect((await screen.findAllByText('PAYMENT_RECEIVED')).length).toBeGreaterThan(0);
  });
});
