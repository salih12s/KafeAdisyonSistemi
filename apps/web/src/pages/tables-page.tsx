import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock3, UsersRound, UtensilsCrossed } from 'lucide-react';
import { formatKurus, type OperationalFloorPlanResponse } from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { useCurrentUser } from '../hooks/use-auth';
import { ApiError, fetchOperationalFloorPlan, openTableCheck } from '../lib/api';
import { cn } from '../lib/cn';
import { CheckView } from './check-view';

type OperationalTable = OperationalFloorPlanResponse['areas'][number]['tables'][number];

const buttonClass =
  'min-h-touch rounded-panel bg-espresso px-4 text-sm font-semibold text-white hover:bg-espresso-soft disabled:opacity-50';
const secondaryButton =
  'min-h-touch rounded-panel border border-line bg-white px-3 text-sm font-medium hover:bg-canvas';

function elapsed(openedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} dk` : `${hours} sa ${minutes % 60} dk`;
}

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
  if (floor.isPending) {
    return (
      <Panel>
        <p className="p-4 text-sm text-ink-muted">Masa durumları yükleniyor…</p>
      </Panel>
    );
  }
  if (floor.isError) {
    return (
      <Panel>
        <p role="alert" className="p-4 text-sm text-danger">
          Masa durumları yüklenemedi.
        </p>
      </Panel>
    );
  }

  if (floor.data.areas.length === 0) {
    return (
      <Panel>
        <div className="p-6 text-center">
          <UtensilsCrossed aria-hidden="true" className="mx-auto h-8 w-8 text-ink-muted" />
          <h2 className="mt-3 text-base font-semibold">Henüz salon veya masa tanımlanmadı.</h2>
          {auth.data?.role === 'OWNER' ? (
            <p className="mt-1 text-sm text-ink-muted">
              <Link className="font-medium text-accent underline" to="/ayarlar">
                Ayarlar
              </Link>{' '}
              bölümünden salon ve masa oluşturabilirsiniz.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">
              İşletme sahibinden masa düzenini oluşturmasını isteyin.
            </p>
          )}
        </div>
      </Panel>
    );
  }

  const selectedArea =
    floor.data.areas.find((area) => area.id === selectedAreaId) ?? floor.data.areas[0];
  const canOpen = auth.isSuccess && auth.data.role !== 'KITCHEN';

  return (
    <div className="space-y-4">
      <Panel title="Salonlar">
        <div className="flex gap-2 overflow-x-auto p-2">
          {floor.data.areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedAreaId(area.id)}
              className={cn(
                'min-h-touch shrink-0 rounded-panel border px-4 text-sm font-medium',
                area.id === selectedArea?.id
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line bg-surface text-ink-muted hover:bg-canvas',
              )}
            >
              {area.name}
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title={selectedArea?.name ?? 'Masalar'}
        meta={`${selectedArea?.tables.length ?? 0} masa`}
      >
        {selectedArea === undefined || selectedArea.tables.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">Bu salonda aktif masa bulunmuyor.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {selectedArea.tables.map((table) => {
              const isOpen = table.openCheck !== null;
              return (
                <li key={table.id}>
                  <button
                    type="button"
                    disabled={!isOpen && !canOpen}
                    onClick={() => {
                      if (table.openCheck === null) setTableToOpen(table);
                      else setSelectedCheckId(table.openCheck.id);
                    }}
                    className={`${isOpen ? 'border-accent bg-accent-soft' : 'border-line bg-surface'} min-h-32 w-full rounded-panel border p-3 text-left disabled:cursor-default`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{table.name}</span>
                      <span className={isOpen ? 'text-accent' : 'text-success'}>
                        {isOpen ? 'Açık' : 'Boş'}
                      </span>
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
                      <UsersRound aria-hidden="true" className="h-4 w-4" />
                      {isOpen
                        ? `${table.openCheck?.guestCount ?? 0} kişi`
                        : table.capacity === null
                          ? 'Kapasite belirtilmedi'
                          : `${table.capacity} kişi`}
                    </span>
                    {table.openCheck === null ? null : (
                      <>
                        <span className="tabular mt-1 block font-semibold">
                          {formatKurus(table.openCheck.totalKurus)}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                          <Clock3 aria-hidden="true" className="h-4 w-4" />{' '}
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

      {tableToOpen === null ? null : (
        <OpenTablePanel
          table={tableToOpen}
          onOpened={setSelectedCheckId}
          onClose={() => setTableToOpen(null)}
        />
      )}
    </div>
  );
}

function OpenTablePanel({
  table,
  onOpened,
  onClose,
}: {
  table: OperationalTable;
  onOpened: (checkId: string) => void;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (guestCount: number) => openTableCheck(table.id, guestCount),
    onSuccess: (check) => {
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      onOpened(check.id);
      onClose();
    },
  });
  return (
    <Panel title={`Masayı aç — ${table.name}`}>
      <form
        aria-label="Masa açma formu"
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          mutation.mutate(Number(new FormData(event.currentTarget).get('guestCount') ?? 1));
        }}
      >
        <label className="text-sm font-medium">
          Kişi sayısı
          <input
            className="mt-1 min-h-touch w-full rounded-panel border border-line bg-white px-3 sm:w-32"
            name="guestCount"
            type="number"
            min="1"
            max="50"
            defaultValue="1"
            required
          />
        </label>
        <button type="submit" className={buttonClass} disabled={mutation.isPending}>
          Masayı aç
        </button>
        <button type="button" className={secondaryButton} onClick={onClose}>
          Vazgeç
        </button>
        {mutation.error === null ? null : (
          <p role="alert" className="text-sm text-danger sm:basis-full">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Masa açılamadı.'}
          </p>
        )}
      </form>
    </Panel>
  );
}
