import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, ReceiptText, UsersRound, UtensilsCrossed } from 'lucide-react';
import { formatKurus } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { useCurrentUser } from '../../auth/hooks/use-auth';
import { fetchOperationalFloorPlan } from '../../orders/api';
import { cn } from '../../../shared/lib/cn';
import { CheckView } from '../../orders/components/check-view';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { Dialog } from '../../../shared/ui/dialog';
import { Badge } from '../../../shared/ui/badge';
import { ErrorState } from '../../../shared/ui/error-state';
import { PanelSkeleton } from '../../../shared/ui/skeleton';
import { OpenTableForm } from '../components/open-table-form';
import { Summary } from '../components/table-summary';
import type { OperationalTable } from '../tables-format';
import { elapsed } from '../tables-format';

export function TablesPage(): JSX.Element {
  const auth = useCurrentUser();
  const floor = useQuery({
    queryKey: ['operational-floor-plan'],
    queryFn: fetchOperationalFloorPlan,
    refetchInterval: 30_000,
  });
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedCheckId, setSelectedCheckId] = useState('');
  const [tableToOpen, setTableToOpen] = useState<OperationalTable | null>(null);

  useEffect(() => {
    if (floor.data !== undefined && !floor.data.areas.some((area) => area.id === selectedAreaId)) {
      setSelectedAreaId(floor.data.areas[0]?.id ?? '');
    }
  }, [floor.data, selectedAreaId]);

  if (selectedCheckId.length > 0) {
    return <CheckView checkId={selectedCheckId} onBack={() => setSelectedCheckId('')} />;
  }
  if (floor.isPending) return <PanelSkeleton rows={4} />;
  if (floor.isError) {
    return (
      <ErrorState
        title="Masa durumları yüklenemedi"
        description="Bağlantıyı kontrol edip yeniden deneyin."
        onRetry={() => void floor.refetch()}
      />
    );
  }

  if (floor.data.areas.length === 0) {
    return (
      <Panel>
        <div className="p-8 text-center">
          <UtensilsCrossed aria-hidden="true" className="mx-auto h-9 w-9 text-ink-subtle" />
          <h2 className="mt-3 text-lg font-bold">Henüz salon veya masa tanımlanmadı</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
            {auth.data?.role === 'OWNER' ? (
              <>
                <Link className="font-bold text-primary underline" to="/ayarlar">
                  Ayarlar
                </Link>{' '}
                bölümünden salon ve masa oluşturabilirsiniz.
              </>
            ) : (
              'İşletme sahibinden masa düzenini oluşturmasını isteyin.'
            )}
          </p>
        </div>
      </Panel>
    );
  }

  const selectedArea =
    floor.data.areas.find((area) => area.id === selectedAreaId) ?? floor.data.areas[0];
  const canOpen = auth.isSuccess && auth.data.role !== 'KITCHEN';
  const openCount = selectedArea?.tables.filter((table) => table.openCheck !== null).length ?? 0;

  return (
    <div className="space-y-5">
      <h2 className="sr-only">Salonlar</h2>
      <SegmentedControl
        label="Salon seçimi"
        value={selectedArea?.id ?? ''}
        options={floor.data.areas.map((area) => ({
          value: area.id,
          label: area.name,
          count: area.tables.length,
        }))}
        onChange={setSelectedAreaId}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Summary label="Toplam masa" value={selectedArea?.tables.length ?? 0} />
        <Summary label="Açık" value={openCount} tone="warning" />
        <Summary
          label="Boş"
          value={(selectedArea?.tables.length ?? 0) - openCount}
          tone="success"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Panel
        title={selectedArea?.name ?? 'Masalar'}
        meta={`${selectedArea?.tables.length ?? 0} masa`}
        variant="elevated"
      >
        {selectedArea === undefined || selectedArea.tables.length === 0 ? (
          <p className="p-6 text-sm text-ink-secondary">Bu salonda aktif masa bulunmuyor.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {selectedArea.tables.map((table) => {
              const isOpen = table.openCheck !== null;
              return (
                <li key={table.id}>
                  <button
                    type="button"
                    disabled={!isOpen && !canOpen}
                    onClick={() =>
                      isOpen ? setSelectedCheckId(table.openCheck?.id ?? '') : setTableToOpen(table)
                    }
                    className={cn(
                      'interactive-card min-h-40 w-full border-l-4 p-4 text-left disabled:cursor-default disabled:opacity-60',
                      isOpen
                        ? 'border-l-warning bg-warning-soft/40'
                        : 'border-l-success bg-surface',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-extrabold">{table.name}</span>
                      <Badge tone={isOpen ? 'warning' : 'success'}>{isOpen ? 'Açık' : 'Boş'}</Badge>
                    </span>
                    <span className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-secondary">
                      <UsersRound aria-hidden="true" className="h-4 w-4" />
                      {isOpen
                        ? `${table.openCheck?.guestCount ?? 0} kişi`
                        : table.capacity === null
                          ? 'Kapasite belirtilmedi'
                          : `${table.capacity} kişi`}
                    </span>
                    {table.openCheck === null ? (
                      <span className="mt-5 block text-xs font-semibold text-success">
                        Yeni adisyon aç
                      </span>
                    ) : (
                      <>
                        <span className="tabular mt-3 flex items-center gap-1.5 text-lg font-extrabold">
                          <ReceiptText className="h-4 w-4 text-ink-subtle" />
                          {formatKurus(table.openCheck.totalKurus)}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-secondary">
                          <Clock3 aria-hidden="true" className="h-4 w-4" />
                          {elapsed(table.openCheck.openedAt)}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog
        open={tableToOpen !== null}
        title={tableToOpen === null ? 'Masayı aç' : `${tableToOpen.name} masasını aç`}
        description="Kişi sayısını girerek yeni adisyonu başlatın."
        onClose={() => setTableToOpen(null)}
        className="sm:max-w-md"
      >
        {tableToOpen === null ? null : (
          <OpenTableForm
            table={tableToOpen}
            onOpened={setSelectedCheckId}
            onClose={() => setTableToOpen(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
