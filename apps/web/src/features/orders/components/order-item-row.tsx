import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatKurus,
  ORDER_ITEM_STATUS_LABELS,
  type CheckResponse,
  type OrderItemResponse,
} from '@kafe/contracts';
import { cancelOrderItem, updateOrderItem } from '../api';
import { formatTimestamp } from '../../../shared/lib/datetime';
import { ErrorText } from '../../../shared/ui/error-text';
import { fieldClass, primaryButton, secondaryButton } from '../order-styles';

export function OrderItemRow({
  item,
  check,
  canManage,
}: {
  item: OrderItemResponse;
  check: CheckResponse;
  canManage: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const apply = (updated: CheckResponse): void => {
    queryClient.setQueryData(['check', check.id], updated);
    void queryClient.invalidateQueries({ queryKey: ['operational-floor-plan'] });
    setEditing(false);
    setCancelling(false);
  };
  const updateMutation = useMutation({
    mutationFn: (form: FormData) =>
      updateOrderItem(item.id, {
        quantity: Number(form.get('quantity') ?? item.quantity),
        note: String(form.get('note') ?? '').trim() || null,
      }),
    onSuccess: apply,
  });
  const cancelMutation = useMutation({
    mutationFn: (form: FormData) => cancelOrderItem(item.id, String(form.get('reason') ?? '')),
    onSuccess: apply,
  });
  const cancelled = item.cancelledAt !== null;

  return (
    <li className={`${cancelled ? 'bg-danger-soft/50' : ''} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`${cancelled ? 'line-through' : ''} font-semibold`}>
            {item.quantity} × {item.productNameSnapshot}
          </p>
          {!cancelled ? (
            <p className="text-[12px] font-medium text-accent">
              {ORDER_ITEM_STATUS_LABELS[item.preparationStatus]}
            </p>
          ) : null}
          {item.options.length > 0 ? (
            <p className="text-[13px] text-ink-muted">
              {item.options
                .map((option) => `${option.groupNameSnapshot}: ${option.valueNameSnapshot}`)
                .join(' · ')}
            </p>
          ) : null}
          {item.note === null ? null : (
            <p className="text-[13px] text-ink-muted">Not: {item.note}</p>
          )}
          <p className="text-[12px] text-ink-muted">
            {item.createdByName} · {formatTimestamp(item.createdAt)}
          </p>
        </div>
        <span className="tabular shrink-0 font-semibold">{formatKurus(item.lineTotalKurus)}</span>
      </div>
      {cancelled ? (
        <p className="mt-2 text-[13px] text-danger">
          İptal: {item.cancellationReason} · {item.cancelledByName}
        </p>
      ) : canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setEditing((value) => !value)}
          >
            Adet / not
          </button>
          <button
            type="button"
            className={`${secondaryButton} text-danger`}
            onClick={() => setCancelling((value) => !value)}
          >
            Kalemi iptal et
          </button>
        </div>
      ) : null}
      {item.complimentaryAt === null ? null : (
        <p className="mt-2 text-[13px] text-success">
          İkram: {item.complimentaryReason} · {item.complimentaryByName}
        </p>
      )}

      {editing ? (
        <form
          aria-label={`${item.productNameSnapshot} kalemini düzenle`}
          className="mt-3 grid gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input
            aria-label="Adet"
            className={fieldClass}
            name="quantity"
            type="number"
            min="1"
            max="100"
            defaultValue={item.quantity}
            required
          />
          <input
            aria-label="Sipariş notu"
            className={fieldClass}
            name="note"
            maxLength={500}
            defaultValue={item.note ?? ''}
          />
          <button type="submit" className={primaryButton} disabled={updateMutation.isPending}>
            Kaydet
          </button>
          <div className="sm:col-span-3">
            <ErrorText error={updateMutation.error} />
          </div>
        </form>
      ) : null}

      {cancelling ? (
        <form
          aria-label={`${item.productNameSnapshot} kalemini iptal et`}
          className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            cancelMutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <input
            aria-label="İptal gerekçesi"
            className={fieldClass}
            name="reason"
            minLength={3}
            maxLength={250}
            required
            placeholder="İptal gerekçesi"
          />
          <button
            type="submit"
            className="min-h-touch rounded-panel bg-danger px-4 text-sm font-semibold text-white"
            disabled={cancelMutation.isPending}
          >
            İptali onayla
          </button>
          <div className="sm:col-span-2">
            <ErrorText error={cancelMutation.error} />
          </div>
        </form>
      ) : null}
    </li>
  );
}
