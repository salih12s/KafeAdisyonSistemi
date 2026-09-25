import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PREPARATION_AREA_LABELS, type KitchenOrderResponse } from '@kafe/contracts';
import { Clock3, Flame, Martini, Printer } from 'lucide-react';
import { ApiError } from '../../../shared/api/http';
import { updateOrderItemStatus } from '../api';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { PrintSheet } from '../../printing/components/print-sheet';
import { usePrintJob } from '../../printing/hooks/use-print-job';
import { KitchenTicket } from '../../printing/components/receipts';
import {
  ACTION_LABEL,
  NEXT_STATUS,
  STATUS_ACCENT,
  formatWaitTime,
  isActiveStatus,
} from '../kitchen-status';

export function KitchenOrderCard({ order }: { order: KitchenOrderResponse }): JSX.Element | null {
  const queryClient = useQueryClient();
  const ticket = usePrintJob();
  const status = isActiveStatus(order.preparationStatus) ? order.preparationStatus : null;
  const mutation = useMutation({
    mutationFn: () => {
      if (status === null) throw new ApiError('Siparişin hazırlık durumu geçersiz.');
      return updateOrderItemStatus(order.itemId, NEXT_STATUS[status]);
    },
    onSuccess: (check) => {
      queryClient.setQueryData(['check', check.id], check);
      void queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
    },
  });
  if (status === null) return null;
  const waitMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60_000),
  );
  const urgency = waitMinutes >= 20 ? 'danger' : waitMinutes >= 10 ? 'warning' : 'neutral';

  return (
    <li
      className={`ticket-enter overflow-hidden rounded-card border border-kds-line border-t-4 ${STATUS_ACCENT[status]} bg-kds-surface shadow-card`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight">
              {order.quantity} × {order.productNameSnapshot}
            </p>
            <p className="mt-1 text-sm font-bold text-kds-muted">{order.tableName}</p>
          </div>
          <span
            title={PREPARATION_AREA_LABELS[order.preparationArea]}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-kds-elevated text-kds-muted"
          >
            {order.preparationArea === 'BAR' ? (
              <Martini className="h-5 w-5" />
            ) : (
              <Flame className="h-5 w-5" />
            )}
          </span>
        </div>
        {order.options.length > 0 ? (
          <ul className="mt-3 space-y-1 border-l-2 border-kds-line pl-3 text-sm text-kds-muted">
            {order.options.map((option) => (
              <li key={`${option.groupNameSnapshot}-${option.valueNameSnapshot}`}>
                {option.groupNameSnapshot}: {option.valueNameSnapshot}
              </li>
            ))}
          </ul>
        ) : null}
        {order.note === null ? null : (
          <p className="mt-3 rounded-control bg-kds-elevated px-3 py-2 text-sm">
            <span className="font-bold text-kds-info">Not:</span> {order.note}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <Badge tone={urgency} icon={<Clock3 className="h-3.5 w-3.5" />}>
            Bekleme: {formatWaitTime(order.createdAt)}
          </Badge>
          <span className="text-xs text-kds-muted">
            {PREPARATION_AREA_LABELS[order.preparationArea]}
          </span>
        </div>
      </div>
      <div className="border-t border-kds-line p-3">
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={`${order.productNameSnapshot} fişini yazdır`}
            title="Fişi yazdır"
            onClick={ticket.print}
            className="flex min-h-touch w-11 shrink-0 items-center justify-center rounded-input border border-kds-line text-kds-muted transition hover:bg-kds-elevated hover:text-kds-ink"
          >
            <Printer aria-hidden="true" className="h-4 w-4" />
          </button>
          <Button
            type="button"
            variant={status === 'READY' ? 'success' : 'primary'}
            size="touch"
            className="flex-1"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {ACTION_LABEL[status]}
          </Button>
        </div>
        {ticket.job === null ? null : (
          <PrintSheet key={ticket.job} onDone={ticket.done}>
            <KitchenTicket order={order} />
          </PrintSheet>
        )}
        {mutation.isError ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Durum değiştirilemedi.'}
          </p>
        ) : null}
      </div>
    </li>
  );
}
