import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackagePlus } from 'lucide-react';
import { formatStockQuantity } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { Badge } from '../../../shared/ui/badge';
import { Button } from '../../../shared/ui/button';
import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { useCurrentUser } from '../../auth/hooks/use-auth';
import { fetchStockItems } from '../api';
import { errorMessage } from '../../../shared/lib/error-message';
import { RecipePanel } from '../components/recipe-panel';
import { StockDetail } from '../components/stock-detail';
import { StockItemDialog } from '../components/stock-item-dialog';
import { ITEMS_KEY } from '../stock-constants';

export function StockPage(): JSX.Element {
  const auth = useCurrentUser();
  const isOwner = auth.data?.role === 'OWNER';
  const [selectedId, setSelectedId] = useState('');
  const [creating, setCreating] = useState(false);
  const items = useQuery({ queryKey: ITEMS_KEY, queryFn: () => fetchStockItems(true) });
  const lowCount = items.data?.filter((item) => item.isLow).length ?? 0;

  return (
    <div className="space-y-5">
      {items.isError ? (
        <ErrorState
          title="Stok listesi alınamadı"
          description={errorMessage(items.error)}
          onRetry={() => void items.refetch()}
        />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <Panel
          title="Stok kalemleri"
          meta={lowCount > 0 ? `${lowCount} kalem azaldı` : `${items.data?.length ?? 0} kalem`}
          variant="elevated"
        >
          {isOwner ? (
            <div className="border-b border-line p-3">
              <Button
                variant="subtle"
                className="w-full"
                icon={<PackagePlus aria-hidden="true" className="h-4 w-4" />}
                onClick={() => setCreating(true)}
              >
                Stok kalemi ekle
              </Button>
            </div>
          ) : null}
          {items.data === undefined || items.data.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Stok kalemi yok"
              description={
                isOwner
                  ? 'Süt, kahve çekirdeği, bardak gibi malzemeleri ekleyin; ürün reçetesine bağladığınızda satışta otomatik düşer.'
                  : 'Stok kalemlerini işletme sahibi tanımlar.'
              }
            />
          ) : (
            <ul aria-label="Stok kalemleri" className="grid gap-2 p-3">
              {items.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    onClick={() => setSelectedId(item.id)}
                    className={`${selectedId === item.id ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:bg-surface-muted'} flex min-h-touch w-full items-center justify-between gap-3 rounded-card border p-3 text-left transition`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{item.name}</strong>
                      <span className="tabular text-sm text-ink-secondary">
                        {formatStockQuantity(item.unit, item.balance)}
                      </span>
                    </span>
                    {!item.isActive ? (
                      <Badge>Pasif</Badge>
                    ) : item.isLow ? (
                      <Badge tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                        {item.balance <= 0 ? 'Tükendi' : 'Azaldı'}
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {selectedId === '' ? (
          <Panel title="Stok ayrıntısı" variant="elevated">
            <EmptyState
              icon={Boxes}
              title="Bir stok kalemi seçin"
              description="Güncel miktar, alım/fire/sayım girişi ve hareket geçmişi burada görünür."
            />
          </Panel>
        ) : (
          <StockDetail key={selectedId} id={selectedId} canEdit={isOwner} />
        )}
      </div>
      <RecipePanel canEdit={isOwner} stockItems={items.data ?? []} />
      <StockItemDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => setSelectedId(id)}
      />
    </div>
  );
}
