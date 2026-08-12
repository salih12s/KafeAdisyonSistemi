import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UsersRound, UtensilsCrossed } from 'lucide-react';
import { Panel } from '../components/ui/panel';
import { useCurrentUser } from '../hooks/use-auth';
import { fetchFloorPlan } from '../lib/api';
import { cn } from '../lib/cn';

export function TablesPage(): JSX.Element {
  const auth = useCurrentUser();
  const floor = useQuery({ queryKey: ['floor-plan'], queryFn: fetchFloorPlan });
  const [selectedAreaId, setSelectedAreaId] = useState('');

  useEffect(() => {
    if (floor.data !== undefined && !floor.data.areas.some((area) => area.id === selectedAreaId)) {
      setSelectedAreaId(floor.data.areas[0]?.id ?? '');
    }
  }, [floor.data, selectedAreaId]);

  if (floor.isPending)
    {return (
      <Panel>
        <p className="p-4 text-sm text-ink-muted">Masa düzeni yükleniyor…</p>
      </Panel>
    );}
  if (floor.isError)
    {return (
      <Panel>
        <p role="alert" className="p-4 text-sm text-danger">
          Masa düzeni yüklenemedi.
        </p>
      </Panel>
    );}

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
            {selectedArea.tables.map((table) => (
              <li
                key={table.id}
                className="min-h-24 rounded-panel border border-line bg-surface p-3"
              >
                <p className="font-semibold">{table.name}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <UsersRound aria-hidden="true" className="h-4 w-4" />
                  {table.capacity === null ? 'Kapasite belirtilmedi' : `${table.capacity} kişi`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
