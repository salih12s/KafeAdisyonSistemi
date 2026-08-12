import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatKurus,
  liraToKurus,
  PAYMENT_METHOD_LABELS,
  type CheckResponse,
  type PaymentMethod,
  type PaymentSplitMode,
  type PaymentSplitResponse,
} from '@kafe/contracts';
import { ApiError, addPayment, closeCheck, previewPaymentSplit } from '../../lib/api';
import { formatTimestamp } from '../../lib/datetime';
import { Panel } from '../ui/panel';
import { Banknote, CreditCard, ReceiptText } from 'lucide-react';
import { Button } from '../ui/button';
import { buttonStyles } from '../ui/button-styles';
import { SegmentedControl } from '../ui/segmented-control';

const inputClass = 'min-h-touch w-full rounded-panel border border-line bg-white px-3 text-sm';
const secondaryButton =
  'min-h-touch rounded-panel border border-line bg-white px-3 text-sm font-medium disabled:opacity-50';

function parseLira(value: string): number {
  return liraToKurus(Number(value.replace(',', '.')));
}

function ErrorText({ error }: { error: unknown }): JSX.Element | null {
  if (error === null) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {error instanceof ApiError ? error.message : 'İşlem tamamlanamadı.'}
    </p>
  );
}

export function CheckPaymentPanel({
  check,
  canManage,
  onClosed,
}: {
  check: CheckResponse;
  canManage: boolean;
  onClosed: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState((check.remainingKurus / 100).toFixed(2));
  const [cashReceived, setCashReceived] = useState((check.remainingKurus / 100).toFixed(2));
  const [splitMode, setSplitMode] = useState<PaymentSplitMode>('AMOUNT');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [split, setSplit] = useState<PaymentSplitResponse | null>(null);

  useEffect(() => {
    setAmount((check.remainingKurus / 100).toFixed(2));
    setCashReceived((check.remainingKurus / 100).toFixed(2));
  }, [check.remainingKurus]);

  const payment = useMutation({
    mutationFn: () => {
      const amountKurus = parseLira(amount);
      return addPayment(check.id, {
        method,
        amountKurus,
        cashReceivedKurus: method === 'CASH' ? parseLira(cashReceived) : null,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['check', check.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      setSplit(null);
    },
  });
  const splitMutation = useMutation({
    mutationFn: () => {
      if (splitMode === 'GUESTS') return previewPaymentSplit(check.id, { mode: 'GUESTS' });
      if (splitMode === 'ITEMS') {
        return previewPaymentSplit(check.id, { mode: 'ITEMS', itemIds: selectedItemIds });
      }
      return previewPaymentSplit(check.id, { mode: 'AMOUNT', amountKurus: parseLira(amount) });
    },
    onSuccess: (result) => {
      setSplit(result);
      const first = result.shares[0];
      if (first !== undefined) {
        setAmount((first.amountKurus / 100).toFixed(2));
        setCashReceived((first.amountKurus / 100).toFixed(2));
      }
    },
  });
  const closeMutation = useMutation({
    mutationFn: () => closeCheck(check.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['check', check.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
      onClosed();
    },
  });

  const appliedKurus = Number.isFinite(Number(amount.replace(',', '.'))) ? parseLira(amount) : 0;
  const receivedKurus = Number.isFinite(Number(cashReceived.replace(',', '.')))
    ? parseLira(cashReceived)
    : 0;
  const changeKurus = Math.max(0, receivedKurus - appliedKurus);
  const open = check.status === 'OPEN';

  return (
    <Panel
      title="Ödeme ve hesap kapatma"
      meta={`${check.payments.length} ödeme`}
      variant="elevated"
    >
      <div className="space-y-5 p-4 sm:p-5">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-card border border-line bg-line text-sm">
          <div>
            <dt className="bg-surface p-3 text-xs text-ink-secondary">Toplam</dt>
            <dd className="tabular bg-surface px-3 pb-3 text-lg font-extrabold">
              {formatKurus(check.totalKurus)}
            </dd>
          </div>
          <div>
            <dt className="bg-surface p-3 text-xs text-ink-secondary">Ödenen</dt>
            <dd className="tabular bg-surface px-3 pb-3 text-lg font-extrabold text-success">
              {formatKurus(check.paidKurus)}
            </dd>
          </div>
          <div>
            <dt className="bg-surface p-3 text-xs text-ink-secondary">Kalan</dt>
            <dd className="tabular bg-surface px-3 pb-3 text-lg font-extrabold text-danger">
              {formatKurus(check.remainingKurus)}
            </dd>
          </div>
        </dl>

        {check.payments.length === 0 ? (
          <p className="text-sm text-ink-muted">Henüz ödeme alınmadı.</p>
        ) : (
          <ul
            aria-label="Ödeme geçmişi"
            className="divide-y divide-line rounded-panel border border-line"
          >
            {check.payments.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  {PAYMENT_METHOD_LABELS[entry.method]} · {entry.receivedByName}
                  <span className="block text-[12px] text-ink-muted">
                    {formatTimestamp(entry.createdAt)}
                  </span>
                </span>
                <strong className="tabular">{formatKurus(entry.amountKurus)}</strong>
              </li>
            ))}
          </ul>
        )}

        {!open ? (
          <p className="rounded-panel bg-success-soft p-3 text-sm font-medium text-success">
            Bu adisyon ödendi ve kapatıldı.
          </p>
        ) : !canManage ? (
          <p className="text-sm text-ink-muted">Bu rol ödeme işlemi yapamaz.</p>
        ) : check.remainingKurus === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-success">Bakiye tamamlandı. Hesabı kapatabilirsiniz.</p>
            <Button
              type="button"
              variant="success"
              loading={closeMutation.isPending}
              onClick={() => closeMutation.mutate()}
            >
              Hesabı kapat
            </Button>
            <ErrorText error={closeMutation.error} />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Hesap böl</p>
              <SegmentedControl
                label="Hesap bölme yöntemi"
                value={splitMode}
                options={[
                  { value: 'AMOUNT', label: 'Tutara göre' },
                  { value: 'ITEMS', label: 'Kaleme göre' },
                  { value: 'GUESTS', label: 'Kişiye göre' },
                ]}
                onChange={(value) => {
                  setSplitMode(value);
                  setSplit(null);
                }}
              />
              {splitMode === 'ITEMS' ? (
                <div className="grid gap-1 sm:grid-cols-2">
                  {check.items
                    .filter((item) => item.cancelledAt === null)
                    .map((item) => (
                      <label
                        key={item.id}
                        className="flex min-h-touch items-center gap-2 rounded-panel border border-line px-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() =>
                            setSelectedItemIds((current) =>
                              current.includes(item.id)
                                ? current.filter((id) => id !== item.id)
                                : [...current, item.id],
                            )
                          }
                        />
                        <span>
                          {item.quantity} × {item.productNameSnapshot} ·{' '}
                          {formatKurus(item.lineTotalKurus)}
                        </span>
                      </label>
                    ))}
                </div>
              ) : null}
              <button
                type="button"
                className={secondaryButton}
                disabled={
                  splitMutation.isPending || (splitMode === 'ITEMS' && selectedItemIds.length === 0)
                }
                onClick={() => splitMutation.mutate()}
              >
                Payları hesapla
              </button>
              <ErrorText error={splitMutation.error} />
              {split === null ? null : (
                <div className="flex flex-wrap gap-2" aria-label="Hesap payları">
                  {split.shares.map((share, index) => (
                    <button
                      key={`${share.label}-${index}`}
                      type="button"
                      className={secondaryButton}
                      onClick={() => {
                        setAmount((share.amountKurus / 100).toFixed(2));
                        setCashReceived((share.amountKurus / 100).toFixed(2));
                      }}
                    >
                      {share.label}: {formatKurus(share.amountKurus)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              aria-label="Ödeme alma formu"
              className="space-y-3 border-t border-line pt-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                payment.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3" aria-label="Ödeme türü">
                {(['CASH', 'CARD'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${value === method ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink'} flex min-h-20 flex-col items-center justify-center gap-2 rounded-card border text-sm font-bold transition`}
                    onClick={() => setMethod(value)}
                  >
                    {value === 'CASH' ? (
                      <Banknote className="h-6 w-6" />
                    ) : (
                      <CreditCard className="h-6 w-6" />
                    )}
                    {PAYMENT_METHOD_LABELS[value]}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Ödenecek tutar (₺)
                  <input
                    aria-label="Ödenecek tutar"
                    className={`${inputClass} mt-1`}
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </label>
                {method === 'CASH' ? (
                  <label className="text-sm font-medium">
                    Alınan nakit (₺)
                    <input
                      aria-label="Alınan nakit"
                      className={`${inputClass} mt-1`}
                      inputMode="decimal"
                      value={cashReceived}
                      onChange={(event) => setCashReceived(event.target.value)}
                      required
                    />
                  </label>
                ) : null}
              </div>
              {method === 'CASH' ? (
                <p className="flex items-center justify-between rounded-card bg-success-soft p-3 text-sm text-success">
                  <span>Para üstü</span>
                  <strong className="tabular text-lg">{formatKurus(changeKurus)}</strong>
                </p>
              ) : null}
              <button
                type="submit"
                className={`${buttonStyles('primary', 'large')} w-full`}
                disabled={payment.isPending || appliedKurus <= 0}
              >
                <ReceiptText className="h-5 w-5" /> Ödeme al
              </button>
              <ErrorText error={payment.error} />
            </form>
          </>
        )}
      </div>
    </Panel>
  );
}
