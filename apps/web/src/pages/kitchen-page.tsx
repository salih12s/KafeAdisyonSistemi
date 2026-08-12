import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ORDER_ITEM_STATUS_LABELS,
  PREPARATION_AREA_LABELS,
  type KitchenOrderResponse,
  type OrderItemStatus,
  type PreparationArea,
} from '@kafe/contracts';
import { ChefHat, Clock3, Flame, Martini, Wifi } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../components/ui/empty-state';
import { ApiError, fetchKitchenOrders, updateOrderItemStatus } from '../lib/api';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ErrorState } from '../components/ui/error-state';
import { Skeleton } from '../components/ui/skeleton';

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
const STATUS_ACCENT = {
  SENT: 'border-t-kds-new',
  PREPARING: 'border-t-kds-preparing',
  READY: 'border-t-kds-ready',
} as const;

type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

function isActiveStatus(status: OrderItemStatus): status is ActiveStatus {
  return ACTIVE_STATUSES.some((candidate) => candidate === status);
}

export function KitchenPage(): JSX.Element {
  const [filter, setFilter] = useState<StationFilter>('ALL');
  const preparationArea = filter === 'ALL' ? undefined : filter;
  const orders = useQuery({
    queryKey: ['kitchen-orders', filter],
    queryFn: () => fetchKitchenOrders(preparationArea),
  });

  return (
    <div className="min-h-dvh bg-kds-bg text-kds-ink">
      <header className="sticky top-0 z-20 border-b border-kds-line bg-kds-bg/95 px-3 py-3 backdrop-blur sm:px-5 lg:px-7">
        <div className="mx-auto flex max-w-[112rem] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-card bg-kds-elevated text-kds-new">
              <ChefHat className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Mutfak ve bar</h1>
              <p className="text-xs text-kds-muted">Canlı hazırlık ekranı</p>
            </div>
            <Badge
              tone={orders.isError ? 'danger' : 'success'}
              icon={<Wifi className="h-3.5 w-3.5" />}
            >
              {orders.isError ? 'Bağlantı sorunu' : 'Canlı'}
            </Badge>
          </div>
          <SegmentedControl
            dark
            label="Hazırlık alanı filtresi"
            value={filter}
            options={[
              {
                value: 'KITCHEN',
                label: 'Mutfak',
                count: orders.data?.filter((order) => order.preparationArea === 'KITCHEN').length,
              },
              {
                value: 'BAR',
                label: 'Bar',
                count: orders.data?.filter((order) => order.preparationArea === 'BAR').length,
              },
              { value: 'ALL', label: 'Tümü', count: orders.data?.length },
            ]}
            onChange={setFilter}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[112rem] p-3 sm:p-5 lg:p-7">
        {orders.isPending ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {ACTIVE_STATUSES.map((status) => (
              <Skeleton key={status} className="h-72 bg-kds-surface" />
            ))}
          </div>
        ) : orders.isError ? (
          <div className="rounded-panel bg-surface p-3 text-ink">
            <ErrorState
              title="Siparişler alınamadı"
              description="Bağlantıyı kontrol edip tekrar deneyin."
              onRetry={() => void orders.refetch()}
            />
          </div>
        ) : orders.data.length === 0 ? (
          <div className="rounded-panel border border-kds-line bg-kds-surface text-kds-ink">
            <EmptyState
              icon={ChefHat}
              title="Bekleyen sipariş yok"
              description="Bu istasyonda hazırlanmayı veya servis edilmeyi bekleyen sipariş bulunmuyor."
            />
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            {ACTIVE_STATUSES.map((status) => (
              <OrderColumn
                key={status}
                status={status}
                orders={orders.data.filter((order) => order.preparationStatus === status)}
              />
            ))}
          </div>
        )}
      </main>
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
    <section aria-labelledby={`kds-${status}`}>
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 id={`kds-${status}`} className="text-sm font-extrabold uppercase tracking-[0.12em]">
          {ORDER_ITEM_STATUS_LABELS[status]}
        </h2>
        <span className="tabular rounded-full bg-kds-elevated px-2.5 py-1 text-xs font-bold text-kds-muted">
          {orders.length}
        </span>
      </header>
      {orders.length === 0 ? (
        <div className="rounded-card border border-dashed border-kds-line p-8 text-center text-sm text-kds-muted">
          Bu durumda sipariş yok.
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => (
            <KitchenOrderCard key={order.itemId} order={order} />
          ))}
        </ul>
      )}
    </section>
  );
}

function KitchenOrderCard({ order }: { order: KitchenOrderResponse }): JSX.Element | null {
  const queryClient = useQueryClient();
  const status = isActiveStatus(order.preparationStatus) ? order.preparationStatus : null;
  const mutation = useMutation({
    mutationFn: () => {
      if (status === null) throw new ApiError('Siparişin hazırlık durumu geçersiz.');
      return updateOrderItemStatus(order.itemId, NEXT_STATUS[status]);
    },
    onSuccess: (check) => {
      queryClient.setQueryData(['check', check.id], check);
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });
  if (status === null) return null;
  const waitMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60_000),
  );
  const urgency = waitMinutes >= 20 ? 'danger' : waitMinutes >= 10 ? 'warning' : 'neutral';

  return (
    <li
      className={`ticket-enter overflow-hidden rounded-card border border-kds-line border-t-4 ${STATUS_ACCENT[status]} bg-kds-surface shadow-kds`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight">
              {order.quantity} × {order.productNameSnapshot}
            </p>
            <p className="mt-1 text-sm font-bold text-kds-muted">{order.tableName}</p>
          </div>
          <span
            title={PREPARATION_AREA_LABELS[order.preparationArea]}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-kds-elevated text-kds-muted"
          >
            {order.preparationArea === 'BAR' ? (
              <Martini className="h-5 w-5" />
            ) : (
              <Flame className="h-5 w-5" />
            )}
          </span>
        </div>
        {order.options.length > 0 ? (
          <ul className="mt-3 space-y-1 border-l-2 border-kds-line pl-3 text-sm text-kds-muted">
            {order.options.map((option) => (
              <li key={`${option.groupNameSnapshot}-${option.valueNameSnapshot}`}>
                {option.groupNameSnapshot}: {option.valueNameSnapshot}
              </li>
            ))}
          </ul>
        ) : null}
        {order.note === null ? null : (
          <p className="mt-3 rounded-control bg-kds-elevated px-3 py-2 text-sm">
            <span className="font-bold text-kds-new">Not:</span> {order.note}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <Badge tone={urgency} icon={<Clock3 className="h-3.5 w-3.5" />}>
            Bekleme: {formatWaitTime(order.createdAt)}
          </Badge>
          <span className="text-xs text-kds-muted">
            {PREPARATION_AREA_LABELS[order.preparationArea]}
          </span>
        </div>
      </div>
      <div className="border-t border-kds-line p-3">
        <Button
          type="button"
          variant={status === 'READY' ? 'success' : 'primary'}
          size="touch"
          className="w-full"
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {ACTION_LABEL[status]}
        </Button>
        {mutation.isError ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Durum değiştirilemedi.'}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function formatWaitTime(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  if (minutes < 1) return '1 dakikadan az';
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}
