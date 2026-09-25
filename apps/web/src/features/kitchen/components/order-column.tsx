import { ORDER_ITEM_STATUS_LABELS, type KitchenOrderResponse } from '@kafe/contracts';
import { KitchenOrderCard } from './kitchen-order-card';
import type { ACTIVE_STATUSES } from '../kitchen-status';

export function OrderColumn({
  status,
  orders,
}: {
  status: (typeof ACTIVE_STATUSES)[number];
  orders: KitchenOrderResponse[];
}): JSX.Element {
  return (
    <section aria-labelledby={`kds-${status}`}>
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 id={`kds-${status}`} className="text-sm font-extrabold uppercase tracking-[0.12em]">
          {ORDER_ITEM_STATUS_LABELS[status]}
        </h2>
        <span className="tabular rounded-full bg-kds-elevated px-2.5 py-1 text-xs font-bold text-kds-muted">
          {orders.length}
        </span>
      </header>
      {orders.length === 0 ? (
        <div className="rounded-card border border-dashed border-kds-line p-8 text-center text-sm text-kds-muted">
          Bu durumda sipariş yok.
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => (
            <KitchenOrderCard key={order.itemId} order={order} />
          ))}
        </ul>
      )}
    </section>
  );
}
