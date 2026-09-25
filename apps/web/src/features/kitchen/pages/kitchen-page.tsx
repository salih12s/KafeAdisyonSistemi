import { useQuery } from '@tanstack/react-query';
import type { PreparationArea } from '@kafe/contracts';
import { ChefHat, Wifi } from 'lucide-react';
import { useState } from 'react';
import { fetchKitchenOrders } from '../api';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { Badge } from '../../../shared/ui/badge';
import { ErrorState } from '../../../shared/ui/error-state';
import { Skeleton } from '../../../shared/ui/skeleton';
import { OrderColumn } from '../components/order-column';
import { ACTIVE_STATUSES } from '../kitchen-status';

type StationFilter = 'ALL' | PreparationArea;

export function KitchenPage(): JSX.Element {
  const [filter, setFilter] = useState<StationFilter>('ALL');
  const preparationArea = filter === 'ALL' ? undefined : filter;
  const orders = useQuery({
    queryKey: ['kitchen-orders', filter],
    queryFn: () => fetchKitchenOrders(preparationArea),
  });

  return (
    <div className="min-w-0 overflow-hidden rounded-panel border border-kds-line bg-kds text-kds-ink shadow-elevated">
      <div className="flex flex-col items-start gap-3 border-b border-kds-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <Badge tone={orders.isError ? 'danger' : 'success'} icon={<Wifi className="h-3.5 w-3.5" />}>
          {orders.isError ? 'Bağlantı sorunu' : 'Canlı'}
        </Badge>
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

      <div className="min-h-96 p-3 sm:p-4">
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
          <div className="flex flex-col items-center rounded-card border border-dashed border-kds-line px-5 py-12 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-kds-elevated text-kds-muted">
              <ChefHat aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="text-base font-bold">Bekleyen sipariş yok</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-kds-muted">
              Bu istasyonda hazırlanmayı veya servis edilmeyi bekleyen sipariş bulunmuyor.
            </p>
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
      </div>
    </div>
  );
}
