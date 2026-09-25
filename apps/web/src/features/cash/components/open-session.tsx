import { CASH_MOVEMENT_TYPE_LABELS, formatKurus, type CashSessionResponse } from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { formatTimestamp } from '../../../shared/lib/datetime';
import { CloseForm } from './close-form';
import { MovementForm } from './movement-form';

export function OpenSession({ session }: { session: CashSessionResponse }): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <Panel
          title="Açık kasa"
          meta={`${session.openedByName} · ${formatTimestamp(session.openedAt)}`}
          variant="elevated"
        >
          <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Açılış" value={session.openingCashKurus} />
            <Metric label="Nakit satış" value={session.cashSalesKurus} />
            <Metric label="Kasaya giriş" value={session.cashInKurus} />
            <Metric label="Kasadan çıkış" value={-session.cashOutKurus} />
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-primary px-4 py-4 text-white">
            <span className="text-sm text-white/75">Çekmecede olması gereken</span>
            <strong className="tabular text-2xl" aria-label="Beklenen nakit">
              {formatKurus(session.expectedCashKurus)}
            </strong>
          </div>
        </Panel>
        <Panel title="Kasa hareketleri" meta={`${session.movements.length} kayıt`}>
          {session.movements.length === 0 ? (
            <p className="p-4 text-sm text-ink-secondary">
              Satış dışı nakit hareketi yok. Bozuk para eklemek veya masraf ödemek için yandaki
              formu kullanın.
            </p>
          ) : (
            <ul aria-label="Kasa hareketleri" className="divide-y divide-line">
              {session.movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{movement.reason}</span>
                    <small className="text-ink-secondary">
                      {CASH_MOVEMENT_TYPE_LABELS[movement.type]} · {movement.actorName} ·{' '}
                      {formatTimestamp(movement.createdAt)}
                    </small>
                  </span>
                  <strong
                    className={`tabular shrink-0 ${movement.type === 'IN' ? 'text-success' : 'text-danger'}`}
                  >
                    {movement.type === 'IN' ? '+' : '−'}
                    {formatKurus(movement.amountKurus)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="space-y-4">
        <MovementForm />
        <CloseForm expectedCashKurus={session.expectedCashKurus} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-secondary">{label}</dt>
      <dd className="tabular mt-1 text-lg font-extrabold">{formatKurus(value)}</dd>
    </div>
  );
}
