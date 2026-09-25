import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import {
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_UNIT_LABELS,
  formatStockQuantity,
  type ManualStockMovementType,
} from '@kafe/contracts';
import { Panel } from '../../../shared/ui/panel';
import { Button } from '../../../shared/ui/button';
import { TextField } from '../../../shared/ui/field';
import { SegmentedControl } from '../../../shared/ui/segmented-control';
import { ErrorState } from '../../../shared/ui/error-state';
import { useToast } from '../../../shared/ui/toast';
import { addStockMovement, fetchStockItem, type StockMovementRequest } from '../api';
import { formatTimestamp } from '../../../shared/lib/datetime';
import { parseWholeNumber } from '../../../shared/lib/money-input';
import { errorMessage } from '../../../shared/lib/error-message';
import { StockItemDialog } from './stock-item-dialog';
import { ITEMS_KEY, UNIT_SHORT } from '../stock-constants';

export function StockDetail({ id, canEdit }: { id: string; canEdit: boolean }): JSX.Element {
  const client = useQueryClient();
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<ManualStockMovementType>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();
  const detail = useQuery({ queryKey: ['stock', 'item', id], queryFn: () => fetchStockItem(id) });
  const record = useMutation({
    mutationFn: (input: StockMovementRequest) => addStockMovement(id, input),
    onSuccess: (item) => {
      client.setQueryData(['stock', 'item', id], item);
      void client.invalidateQueries({ queryKey: ITEMS_KEY });
      setQuantity('');
      setReason('');
      notify('Stok hareketi kaydedildi.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  if (detail.isError) {
    return <ErrorState title="Stok kalemi alınamadı" description={errorMessage(detail.error)} />;
  }
  if (detail.data === undefined) {
    return <p className="p-4 text-sm text-ink-muted">Yükleniyor…</p>;
  }
  const item = detail.data;
  const unit = UNIT_SHORT[item.unit];

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = parseWholeNumber(quantity);
    if (value === null || (type !== 'ADJUSTMENT' && value === 0)) {
      setError(`Miktarı tam sayı olarak ${unit} cinsinden girin.`);
      return;
    }
    setError(undefined);
    const note = reason.trim();
    record.mutate(
      type === 'ADJUSTMENT'
        ? { type, countedQuantity: value, reason: note }
        : { type, quantity: value, reason: note || null },
    );
  };

  return (
    <Panel
      title="Stok ayrıntısı"
      meta={`${STOCK_UNIT_LABELS[item.unit]} · uyarı eşiği ${formatStockQuantity(item.unit, item.lowStockThreshold)}`}
      variant="elevated"
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">{item.name}</h2>
            <p className="tabular mt-1 text-2xl font-extrabold" aria-label="Güncel stok">
              {formatStockQuantity(item.unit, item.balance)}
            </p>
          </div>
          {canEdit ? (
            <Button
              variant="outline"
              size="small"
              icon={<Pencil aria-hidden="true" className="h-4 w-4" />}
              onClick={() => setEditing(true)}
            >
              Düzenle
            </Button>
          ) : null}
        </div>
        <form aria-label="Stok hareketi formu" className="grid gap-3" onSubmit={submit}>
          <SegmentedControl
            label="Hareket türü"
            value={type}
            onChange={setType}
            options={[
              { value: 'PURCHASE', label: STOCK_MOVEMENT_TYPE_LABELS.PURCHASE },
              { value: 'WASTE', label: STOCK_MOVEMENT_TYPE_LABELS.WASTE },
              { value: 'ADJUSTMENT', label: STOCK_MOVEMENT_TYPE_LABELS.ADJUSTMENT },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <TextField
              id="stock-quantity"
              label={type === 'ADJUSTMENT' ? `Sayılan miktar (${unit})` : `Miktar (${unit})`}
              inputMode="numeric"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              error={error}
            />
            <TextField
              id="stock-reason"
              label="Açıklama"
              required={type === 'ADJUSTMENT'}
              minLength={type === 'ADJUSTMENT' ? 3 : undefined}
              maxLength={250}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={type === 'PURCHASE' ? 'Örn. tedarikçi faturası' : 'Nedeni'}
            />
            <Button type="submit" loading={record.isPending}>
              Kaydet
            </Button>
          </div>
          {type === 'ADJUSTMENT' ? (
            <p className="text-xs text-ink-secondary">
              Rafta saydığınız miktarı girin; sistem farkı hesaplayıp düzeltme hareketi yazar.
            </p>
          ) : null}
        </form>
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 font-bold">Hareketler</h3>
          {item.movements.length === 0 ? (
            <p className="text-sm text-ink-secondary">Henüz hareket yok.</p>
          ) : (
            <ul aria-label="Stok hareketleri" className="divide-y divide-line">
              {item.movements.map((movement) => (
                <li key={movement.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {STOCK_MOVEMENT_TYPE_LABELS[movement.type]}
                      {movement.reason === null ? '' : ` · ${movement.reason}`}
                    </span>
                    <small className="text-ink-secondary">
                      {movement.actorName} · {formatTimestamp(movement.createdAt)}
                    </small>
                  </span>
                  <strong
                    className={`tabular shrink-0 ${movement.quantityDelta > 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {movement.quantityDelta > 0 ? '+' : '−'}
                    {formatStockQuantity(item.unit, Math.abs(movement.quantityDelta))}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <StockItemDialog open={editing} item={item} onClose={() => setEditing(false)} />
    </Panel>
  );
}
