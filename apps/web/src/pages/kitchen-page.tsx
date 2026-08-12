import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_ITEM_STATUS_LABELS,
  PREPARATION_AREA_LABELS,
  type KitchenOrderResponse,
  type OrderItemStatus,
  type PreparationArea,
} from '@kafe/contracts';
import { ChefHat } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/ui/empty-state';
import { Panel } from '../components/ui/panel';
import { ApiError, fetchKitchenOrders, updateOrderItemStatus } from '../lib/api';

type StationFilter = 'ALL' | PreparationArea;
const ACTIVE_STATUSES = ['SENT', 'PREPARING', 'READY'] as const;

const NEXT_STATUS: Record<(typeof ACTIVE_STATUSES)[number], OrderItemStatus> = {
  SENT: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
};

const ACTION_LABEL: Record<(typeof ACTIVE_STATUSES)[number], string> = {
  SENT: 'Hazırlamaya başla',
  PREPARING: 'Hazır',
  READY: 'Servis edildi',
};

export function KitchenPage(): JSX.Element {
  const [filter, setFilter] = useState<StationFilter>('ALL');
  const preparationArea = filter === 'ALL' ? undefined : filter;
  const orders = useQuery({
    queryKey: ['kitchen-orders', filter],
    queryFn: () => fetchKitchenOrders(preparationArea),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Mutfak ve bar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Aktif siparişleri istasyona ve hazırlık durumuna göre yönetin.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto" aria-label="Hazırlık alanı filtresi">
        {(
          [
            ['KITCHEN', 'Mutfak'],
            ['BAR', 'Bar'],
            ['ALL', 'Tümü'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`${filter === value ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-white text-ink-muted'} min-h-touch shrink-0 rounded-panel border px-5 text-sm font-semibold`}
          >
            {label}
          </button>
        ))}
      </div>

      {orders.isPending ? (
        <Panel>
          <p className="p-4 text-sm text-ink-muted">Siparişler yükleniyor…</p>
        </Panel>
      ) : orders.isError ? (
        <Panel>
          <p role="alert" className="p-4 text-sm text-danger">
            Hazırlık siparişleri yüklenemedi.
          </p>
        </Panel>
      ) : orders.data.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ChefHat}
            title="Bekleyen sipariş yok"
            description="Bu filtrede hazırlanmayı veya servis edilmeyi bekleyen sipariş bulunmuyor."
          />
        </Panel>
      ) : (
        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          {ACTIVE_STATUSES.map((status) => (
            <OrderColumn
              key={status}
              status={status}
              orders={orders.data.filter((order) => order.preparationStatus === status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderColumn({
  status,
  orders,
}: {
  status: (typeof ACTIVE_STATUSES)[number];
  orders: KitchenOrderResponse[];
}): JSX.Element {
  return (
    <Panel title={ORDER_ITEM_STATUS_LABELS[status]} meta={`${orders.length} sipariş`}>
      {orders.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">Bu durumda sipariş yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <KitchenOrderCard key={order.itemId} order={order} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function KitchenOrderCard({ order }: { order: KitchenOrderResponse }): JSX.Element {
  const queryClient = useQueryClient();
  const status = order.preparationStatus as (typeof ACTIVE_STATUSES)[number];
  const mutation = useMutation({
    mutationFn: () => updateOrderItemStatus(order.itemId, NEXT_STATUS[status]),
    onSuccess: (check) => {
      queryClient.setQueryData(['check', check.id], check);
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });

  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">
            {order.quantity} × {order.productNameSnapshot}
          </p>
          <p className="text-[13px] font-medium text-accent">{order.tableName}</p>
        </div>
        <span className="shrink-0 rounded-panel bg-canvas px-2 py-1 text-[12px] font-semibold">
          {PREPARATION_AREA_LABELS[order.preparationArea]}
        </span>
      </div>
      {order.options.length > 0 ? (
        <p className="mt-2 text-[13px] text-ink-muted">
          {order.options
            .map((option) => `${option.groupNameSnapshot}: ${option.valueNameSnapshot}`)
            .join(' · ')}
        </p>
      ) : null}
      {order.note === null ? null : (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Not:</span> {order.note}
        </p>
      )}
      <p className="mt-2 text-[12px] text-ink-muted">Bekleme: {formatWaitTime(order.createdAt)}</p>
      <button
        type="button"
        className="mt-3 min-h-touch w-full rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:opacity-50"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {ACTION_LABEL[status]}
      </button>
      {mutation.isError ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Durum değiştirilemedi.'}
        </p>
      ) : null}
    </li>
  );
}

function formatWaitTime(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return '1 dakikadan az';
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}
