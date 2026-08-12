import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ORDER_REALTIME_EVENT, type OrderRealtimeEvent } from '@kafe/contracts';

const socketHarness = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload?: unknown) => void>>();
  const socket = {
    on(event: string, listener: (payload?: unknown) => void) {
      const entries = listeners.get(event) ?? new Set();
      entries.add(listener);
      listeners.set(event, entries);
      return socket;
    },
    off(event: string, listener: (payload?: unknown) => void) {
      listeners.get(event)?.delete(listener);
      return socket;
    },
    disconnect: vi.fn(),
  };
  return {
    socket,
    emit(event: string, payload?: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
  };
});

vi.mock('socket.io-client', () => ({ io: () => socketHarness.socket }));

import { App } from '../App';
import { recordedRequests, renderWithProviders, stubAppFetch } from '../test/render';

const check = {
  id: '00000000-0000-4000-8000-000000000202',
  tableId: '00000000-0000-4000-8000-000000000201',
  tableName: 'Masa 4',
  openedByUserId: '00000000-0000-4000-8000-000000000001',
  openedByName: 'İşletme Sahibi',
  guestCount: 2,
  status: 'OPEN',
  openedAt: '2026-08-12T09:00:00.000Z',
  totalKurus: 8000,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000203',
      productId: '00000000-0000-4000-8000-000000000204',
      productNameSnapshot: 'Latte',
      unitPriceKurusSnapshot: 8000,
      preparationAreaSnapshot: 'BAR',
      preparationStatus: 'SENT',
      quantity: 1,
      note: 'Az sıcak',
      lineTotalKurus: 8000,
      createdByUserId: '00000000-0000-4000-8000-000000000001',
      createdByName: 'İşletme Sahibi',
      createdAt: '2026-08-12T09:05:00.000Z',
      cancelledAt: null,
      cancellationReason: null,
      cancelledByUserId: null,
      cancelledByName: null,
      options: [],
    },
  ],
};

const kitchenOrders = [
  {
    itemId: '00000000-0000-4000-8000-000000000203',
    checkId: check.id,
    tableName: 'Masa 4',
    productNameSnapshot: 'Latte',
    quantity: 1,
    note: 'Az sıcak',
    preparationArea: 'BAR',
    preparationStatus: 'SENT',
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    options: [{ groupNameSnapshot: 'Süt', valueNameSnapshot: 'Yulaf' }],
  },
  {
    itemId: '00000000-0000-4000-8000-000000000205',
    checkId: check.id,
    tableName: 'Masa 4',
    productNameSnapshot: 'Tost',
    quantity: 2,
    note: null,
    preparationArea: 'KITCHEN',
    preparationStatus: 'PREPARING',
    createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    options: [],
  },
];

describe('Phase 4 mutfak ve realtime arayüzü', () => {
  it('siparişleri durum, istasyon, seçenek, not ve bekleme süresiyle gösterir', async () => {
    stubAppFetch({ kitchenOrders });
    renderWithProviders(<App />, '/mutfak');
    expect(await screen.findByText('Mutfak ve bar')).toBeInTheDocument();
    expect(await screen.findByText('1 × Latte')).toBeInTheDocument();
    expect(screen.getByText('2 × Tost')).toBeInTheDocument();
    expect(screen.getByText('Süt: Yulaf')).toBeInTheDocument();
    expect(screen.getByText('Az sıcak')).toBeInTheDocument();
    expect(screen.getAllByText(/Bekleme:/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hazırlamaya başla' })).toHaveClass('min-h-touch');
  });

  it('Mutfak/Bar/Tümü filtresini REST sorgusuna taşır', async () => {
    stubAppFetch({ kitchenOrders });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/mutfak');
    await screen.findByText('1 × Latte');
    const filters = screen.getByLabelText('Hazırlık alanı filtresi');
    await user.click(within(filters).getByRole('button', { name: 'Bar' }));
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/orders/kitchen?preparationArea=BAR',
        expect.any(Object),
      );
    });
  });

  it('hazırlık aksiyonunu backend status endpointine gönderir', async () => {
    stubAppFetch({ kitchenOrders, check });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/mutfak');
    await user.click(await screen.findByRole('button', { name: 'Hazırlamaya başla' }));
    await waitFor(() => {
      expect(recordedRequests).toContainEqual({
        path: '/api/orders/items/00000000-0000-4000-8000-000000000203/status',
        method: 'PATCH',
        body: { status: 'PREPARING' },
      });
    });
  });

  it('reconnect ve order event sonrası REST verisini refetch eder', async () => {
    stubAppFetch({ kitchenOrders });
    renderWithProviders(<App />, '/mutfak');
    await screen.findByText('1 × Latte');
    const kitchenCallCount = (): number =>
      vi.mocked(fetch).mock.calls.filter(([path]) => String(path).startsWith('/api/orders/kitchen'))
        .length;
    const initial = kitchenCallCount();

    socketHarness.emit('connect');
    await waitFor(() => expect(kitchenCallCount()).toBeGreaterThan(initial));
    const afterReconnect = kitchenCallCount();
    const event: OrderRealtimeEvent = {
      type: 'ITEM_STATUS_CHANGED',
      checkId: check.id,
      itemId: check.items[0]?.id ?? '',
      preparationArea: 'BAR',
    };
    socketHarness.emit(ORDER_REALTIME_EVENT, event);
    await waitFor(() => expect(kitchenCallCount()).toBeGreaterThan(afterReconnect));
  });
});
