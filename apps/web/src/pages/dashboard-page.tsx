import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  Clock3,
  Landmark,
  LayoutGrid,
  ReceiptText,
  Wifi,
} from 'lucide-react';
import { formatKurus, formatStockQuantity } from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { Badge } from '../components/ui/badge';
import { navigationForRole } from '../config/navigation';
import { useHealth } from '../hooks/use-health';
import { useCurrentUser } from '../hooks/use-auth';
import {
  fetchCurrentCashSession,
  fetchKitchenOrders,
  fetchOperationalFloorPlan,
  fetchStockItems,
} from '../lib/api';
import { formatTimestamp } from '../lib/datetime';
import { Skeleton } from '../components/ui/skeleton';

export function DashboardPage(): JSX.Element {
  const health = useHealth();
  const auth = useCurrentUser();
  const canSeeFloor = auth.isSuccess && auth.data.role !== 'KITCHEN';
  const floor = useQuery({
    queryKey: ['operational-floor-plan'],
    queryFn: fetchOperationalFloorPlan,
    enabled: canSeeFloor,
    refetchInterval: 30_000,
  });
  const canSeeOperations =
    auth.isSuccess && (auth.data.role === 'OWNER' || auth.data.role === 'CASHIER');
  const cash = useQuery({
    queryKey: ['cash', 'current'],
    queryFn: fetchCurrentCashSession,
    enabled: canSeeOperations,
  });
  const stock = useQuery({
    queryKey: ['stock', 'items'],
    queryFn: () => fetchStockItems(true),
    enabled: canSeeOperations,
  });
  const lowStock = stock.data?.filter((item) => item.isLow) ?? [];
  const kitchen = useQuery({
    queryKey: ['kitchen-orders', 'ALL'],
    queryFn: () => fetchKitchenOrders(),
    enabled: auth.isSuccess,
  });

  const tables = floor.data?.areas.flatMap((area) => area.tables) ?? [];
  const openTables = tables.filter((table) => table.openCheck !== null);
  const openTotal = openTables.reduce(
    (total, table) => total + (table.openCheck?.totalKurus ?? 0),
    0,
  );
  const preparing =
    kitchen.data?.filter((order) => order.preparationStatus === 'PREPARING').length ?? 0;
  const ready = kitchen.data?.filter((order) => order.preparationStatus === 'READY').length ?? 0;
  const modules = auth.isSuccess
    ? navigationForRole(auth.data.role).filter((item) => item.to !== '/')
    : [];
  const firstName = auth.data?.fullName.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          {firstName.length > 0 ? `Merhaba, ${firstName}` : 'Merhaba'}
        </h2>
        <Badge
          tone={
            health.data?.database === 'connected'
              ? 'success'
              : health.isPending
                ? 'neutral'
                : 'danger'
          }
          icon={<Wifi className="h-3.5 w-3.5" />}
        >
          {health.data?.database === 'connected'
            ? 'Sistem çevrimiçi'
            : health.isPending
              ? 'Bağlantı kontrol ediliyor'
              : 'Bağlantı sorunu'}
        </Badge>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Operasyon metrikleri"
      >
        <MetricCard
          icon={LayoutGrid}
          label="Açık masa"
          value={canSeeFloor ? String(openTables.length) : '—'}
          detail={canSeeFloor ? `${tables.length} aktif masadan` : 'Masa görünümü rolünüzde kapalı'}
          loading={canSeeFloor && floor.isPending}
        />
        <MetricCard
          icon={ReceiptText}
          label="Açık adisyon toplamı"
          value={canSeeFloor ? formatKurus(openTotal) : '—'}
          detail="Sunucudaki güncel adisyonlar"
          loading={canSeeFloor && floor.isPending}
        />
        <MetricCard
          icon={ChefHat}
          label="Hazırlanıyor"
          value={String(preparing)}
          detail={`${ready} sipariş servise hazır`}
          loading={kitchen.isPending}
        />
        <MetricCard
          icon={Clock3}
          label="Bekleyen sipariş"
          value={String(
            kitchen.data?.filter((order) => order.preparationStatus === 'SENT').length ?? 0,
          )}
          detail="Mutfak ve bar toplamı"
          loading={kitchen.isPending}
        />
      </section>

      {canSeeOperations ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Kasa ve stok durumu">
          <Panel title="Kasa" variant="elevated">
            <Link to="/kasa" className="flex items-center gap-4 p-4 hover:bg-surface-muted">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-surface-muted text-primary">
                <Landmark aria-hidden="true" className="h-5 w-5" />
              </span>
              {cash.data === undefined ? (
                <span className="text-sm text-ink-secondary">Kasa durumu yükleniyor…</span>
              ) : cash.data === null ? (
                <span className="min-w-0">
                  <strong className="block">Kasa kapalı</strong>
                  <span className="text-sm text-ink-secondary">
                    Vardiyaya başlarken açılış nakdini girin.
                  </span>
                </span>
              ) : (
                <span className="min-w-0">
                  <strong className="tabular block text-lg">
                    {formatKurus(cash.data.expectedCashKurus)}
                  </strong>
                  <span className="text-sm text-ink-secondary">
                    Çekmecede beklenen · {cash.data.openedByName},{' '}
                    {formatTimestamp(cash.data.openedAt)}
                  </span>
                </span>
              )}
            </Link>
          </Panel>
          <Panel
            title="Stok uyarıları"
            meta={lowStock.length === 0 ? undefined : `${lowStock.length} kalem`}
            variant={lowStock.length === 0 ? 'elevated' : 'danger'}
          >
            {lowStock.length === 0 ? (
              <p className="p-4 text-sm text-ink-secondary">
                {stock.isPending ? 'Stok yükleniyor…' : 'Uyarı eşiğinin altında stok yok.'}
              </p>
            ) : (
              <ul aria-label="Azalan stoklar" className="divide-y divide-danger/15">
                {lowStock.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/stok"
                      className="flex min-h-touch items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-danger" />
                        {item.name}
                      </span>
                      <span className="tabular text-ink-secondary">
                        {formatStockQuantity(item.unit, item.balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      ) : null}

      <Panel title="Hızlı işlemler" meta="Rolünüze açık çalışma alanları" variant="elevated">
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex min-h-28 gap-4 bg-surface p-4 hover:bg-surface-muted"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-soft text-primary">
                <item.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-bold">
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </span>
                <span className="mt-1.5 block text-[13px] leading-5 text-ink-secondary">
                  {item.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>

      {health.isError || health.data?.database === 'disconnected' ? (
        <Panel title="Bağlantı desteği" variant="danger">
          <p className="p-4 text-sm leading-6 text-danger">
            {health.isError
              ? 'API sunucusuna ulaşılamıyor. Yerel sunucunun çalıştığını doğrulayıp yeniden deneyin.'
              : 'Sunucu açık ancak PostgreSQL bağlantısı kurulamıyor. Yerel veritabanı servisini kontrol edin.'}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: typeof LayoutGrid;
  label: string;
  value: string;
  detail: string;
  loading: boolean;
}): JSX.Element {
  return (
    <div className="surface-card p-4 sm:p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-card bg-surface-muted text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-secondary">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="tabular mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      )}
      <p className="mt-1 text-xs text-ink-secondary">{detail}</p>
    </div>
  );
}
