import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, LockKeyhole, Minus, Plus } from 'lucide-react';
import {
  CASH_MOVEMENT_TYPE_LABELS,
  formatKurus,
  type CashMovementType,
  type CashSessionResponse,
} from '@kafe/contracts';
import { Panel } from '../components/ui/panel';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { TextField } from '../components/ui/field';
import { SegmentedControl } from '../components/ui/segmented-control';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { useToast } from '../components/ui/toast';
import {
  ApiError,
  addCashMovement,
  closeCashSession,
  fetchCashSessions,
  fetchCurrentCashSession,
  openCashSession,
} from '../lib/api';
import { formatDateTime, formatTimestamp } from '../lib/datetime';
import { parseLiraToKurus } from '../lib/money-input';

const CURRENT_KEY = ['cash', 'current'] as const;
const HISTORY_KEY = ['cash', 'sessions'] as const;
const INVALID_AMOUNT = 'Tutarı 125,50 biçiminde girin.';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.';
}

function differenceTone(difference: number): 'success' | 'warning' | 'danger' {
  if (difference === 0) return 'success';
  return difference > 0 ? 'warning' : 'danger';
}

function differenceLabel(difference: number): string {
  if (difference === 0) return 'Kasa tuttu';
  return difference > 0
    ? `${formatKurus(difference)} fazla`
    : `${formatKurus(Math.abs(difference))} eksik`;
}

export function CashPage(): JSX.Element {
  const current = useQuery({
    queryKey: CURRENT_KEY,
    queryFn: fetchCurrentCashSession,
    // Nakit ödemeler başka cihazlardan gelir; beklenen tutar düzenli yenilenir.
    refetchInterval: 30_000,
  });
  const history = useQuery({ queryKey: HISTORY_KEY, queryFn: fetchCashSessions });

  return (
    <div className="space-y-5">
      {current.isError ? (
        <ErrorState
          title="Kasa bilgisi alınamadı"
          description={errorMessage(current.error)}
          onRetry={() => void current.refetch()}
        />
      ) : current.isPending ? (
        <p className="text-sm text-ink-muted">Kasa yükleniyor…</p>
      ) : current.data === null ? (
        <OpenCashForm />
      ) : (
        <OpenSession session={current.data} />
      )}

      <Panel title="Kapanmış kasalar" meta={`Son ${history.data?.length ?? 0} vardiya`}>
        {history.data === undefined || history.data.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Henüz kapanmış kasa yok"
            description="Kapatılan her vardiya burada beklenen, sayılan tutar ve farkıyla listelenir."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-secondary">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-semibold">Kapanış</th>
                  <th className="px-4 py-3 font-semibold">Açan / kapatan</th>
                  <th className="px-4 py-3 text-right font-semibold">Beklenen</th>
                  <th className="px-4 py-3 text-right font-semibold">Sayılan</th>
                  <th className="px-4 py-3 text-right font-semibold">Fark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.data.map((session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-3">
                      {session.closedAt === null ? '—' : formatDateTime(session.closedAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {session.openedByName} / {session.closedByName ?? '—'}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatKurus(session.expectedCashKurus)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {session.countedCashKurus === null
                        ? '—'
                        : formatKurus(session.countedCashKurus)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.differenceKurus === null ? (
                        '—'
                      ) : (
                        <Badge tone={differenceTone(session.differenceKurus)}>
                          {differenceLabel(session.differenceKurus)}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function OpenCashForm(): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const open = useMutation({
    mutationFn: openCashSession,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, session);
      notify('Kasa açıldı.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const openingCashKurus = parseLiraToKurus(amount);
    if (openingCashKurus === null) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    open.mutate({ openingCashKurus, note: note.trim() || null });
  };
  return (
    <Panel title="Kasa kapalı" variant="elevated">
      <form aria-label="Kasa açılış formu" className="grid gap-4 p-4 sm:p-5" onSubmit={submit}>
        <p className="max-w-xl text-sm text-ink-secondary">
          Vardiyaya başlarken çekmecedeki bozuk parayı sayın ve açılış tutarı olarak girin. Kasa
          açıkken alınan nakit ödemeler beklenen tutara otomatik eklenir.
        </p>
        <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <TextField
            id="opening-cash"
            label="Açılış nakdi (₺)"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            error={error}
          />
          <TextField
            id="opening-note"
            label="Not"
            value={note}
            maxLength={250}
            onChange={(event) => setNote(event.target.value)}
            placeholder="İsteğe bağlı"
          />
        </div>
        <div>
          <Button
            type="submit"
            loading={open.isPending}
            icon={<Landmark aria-hidden="true" className="h-4 w-4" />}
          >
            Kasayı aç
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function OpenSession({ session }: { session: CashSessionResponse }): JSX.Element {
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

function MovementForm(): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [type, setType] = useState<CashMovementType>('IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const add = useMutation({
    mutationFn: addCashMovement,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, session);
      setAmount('');
      setReason('');
      notify('Kasa hareketi kaydedildi.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const amountKurus = parseLiraToKurus(amount);
    if (amountKurus === null || amountKurus === 0) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    add.mutate({ type, amountKurus, reason: reason.trim() });
  };
  return (
    <Panel title="Nakit giriş / çıkış">
      <form aria-label="Kasa hareketi formu" className="grid gap-3 p-4" onSubmit={submit}>
        <SegmentedControl
          label="Hareket türü"
          value={type}
          onChange={setType}
          options={[
            { value: 'IN', label: CASH_MOVEMENT_TYPE_LABELS.IN },
            { value: 'OUT', label: CASH_MOVEMENT_TYPE_LABELS.OUT },
          ]}
        />
        <TextField
          id="movement-amount"
          label="Tutar (₺)"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={error}
        />
        <TextField
          id="movement-reason"
          label="Açıklama"
          required
          minLength={3}
          maxLength={250}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={type === 'IN' ? 'Örn. bozuk para' : 'Örn. süt alımı'}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={add.isPending}
          icon={
            type === 'IN' ? (
              <Plus aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Minus aria-hidden="true" className="h-4 w-4" />
            )
          }
        >
          Hareketi kaydet
        </Button>
      </form>
    </Panel>
  );
}

function CloseForm({ expectedCashKurus }: { expectedCashKurus: number }): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const countedKurus = parseLiraToKurus(counted);
  const close = useMutation({
    mutationFn: closeCashSession,
    onSuccess: (session) => {
      client.setQueryData(CURRENT_KEY, null);
      void client.invalidateQueries({ queryKey: HISTORY_KEY });
      notify(
        session.differenceKurus === null
          ? 'Kasa kapatıldı.'
          : `Kasa kapatıldı: ${differenceLabel(session.differenceKurus)}.`,
      );
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (countedKurus === null) {
      setError(INVALID_AMOUNT);
      return;
    }
    setError(undefined);
    close.mutate({ countedCashKurus: countedKurus, note: note.trim() || null });
  };
  const preview = countedKurus === null ? null : countedKurus - expectedCashKurus;
  return (
    <Panel title="Vardiya sonu" variant="muted">
      <form aria-label="Kasa kapanış formu" className="grid gap-3 p-4" onSubmit={submit}>
        <TextField
          id="counted-cash"
          label="Sayılan nakit (₺)"
          inputMode="decimal"
          required
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
          error={error}
        />
        {preview === null ? null : (
          <p className="flex items-center justify-between gap-2 text-sm" aria-live="polite">
            <span className="text-ink-secondary">Sayım farkı</span>
            <Badge tone={differenceTone(preview)}>{differenceLabel(preview)}</Badge>
          </p>
        )}
        <TextField
          id="closing-note"
          label="Kapanış notu"
          maxLength={250}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Fark varsa nedenini yazın"
        />
        <Button
          type="submit"
          variant="primary"
          loading={close.isPending}
          icon={<LockKeyhole aria-hidden="true" className="h-4 w-4" />}
        >
          Kasayı kapat
        </Button>
      </form>
    </Panel>
  );
}
