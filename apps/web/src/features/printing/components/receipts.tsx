import {
  PAYMENT_METHOD_LABELS,
  formatKurus,
  type CheckResponse,
  type KitchenOrderResponse,
} from '@kafe/contracts';
import { APP_NAME } from '../../../shared/config/app-info';
import { formatDateTime, formatTimestamp } from '../../../shared/lib/datetime';

const PREPARATION_LABELS = { KITCHEN: 'MUTFAK', BAR: 'BAR' } as const;

/**
 * Müşteriye verilen adisyon bilgi fişi. Yazarkasa fişi değildir; bu yüzden
 * altında "mali değeri yoktur" ibaresi bulunur.
 */
export function CheckReceipt({ check }: { check: CheckResponse }): JSX.Element {
  const items = check.items.filter((item) => item.cancelledAt === null);
  return (
    <article aria-label="Adisyon fişi" className="receipt">
      <header className="receipt__center">
        <strong className="receipt__title">{APP_NAME}</strong>
        <div>ADİSYON</div>
      </header>
      <div className="receipt__rule" />
      <div className="receipt__row">
        <span>{check.tableName}</span>
        <span>{check.guestCount} kişi</span>
      </div>
      <div className="receipt__row">
        <span>{formatDateTime(check.closedAt ?? new Date().toISOString())}</span>
        <span>{check.openedByName}</span>
      </div>
      <div className="receipt__rule" />
      {items.map((item) => (
        <div key={item.id} className="receipt__item">
          <div className="receipt__row">
            <span>
              {item.quantity} × {item.productNameSnapshot}
            </span>
            <span>
              {item.complimentaryAt === null ? formatKurus(item.lineTotalKurus) : 'İkram'}
            </span>
          </div>
          {item.options.map((option) => (
            <div key={option.id} className="receipt__detail">
              {option.groupNameSnapshot}: {option.valueNameSnapshot}
            </div>
          ))}
        </div>
      ))}
      <div className="receipt__rule" />
      {check.discounts.map((discount) => (
        <div key={discount.id} className="receipt__row">
          <span>İndirim ({discount.reason})</span>
          <span>−{formatKurus(discount.amountKurus)}</span>
        </div>
      ))}
      <div className="receipt__row receipt__total">
        <span>TOPLAM</span>
        <span>{formatKurus(check.totalKurus)}</span>
      </div>
      {check.payments.map((payment) => (
        <div key={payment.id} className="receipt__row">
          <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
          <span>{formatKurus(payment.amountKurus)}</span>
        </div>
      ))}
      {check.remainingKurus > 0 ? (
        <div className="receipt__row">
          <span>Kalan</span>
          <span>{formatKurus(check.remainingKurus)}</span>
        </div>
      ) : null}
      <div className="receipt__rule" />
      <footer className="receipt__center receipt__detail">
        Bilgi fişidir, mali değeri yoktur.
        <br />
        Afiyet olsun.
      </footer>
    </article>
  );
}

/** Mutfak/bar için tek kalemlik hazırlık fişi. Fiyat içermez. */
export function KitchenTicket({ order }: { order: KitchenOrderResponse }): JSX.Element {
  return (
    <article aria-label="Mutfak fişi" className="receipt">
      <header className="receipt__row">
        <strong>{PREPARATION_LABELS[order.preparationArea]}</strong>
        <span>{formatTimestamp(order.createdAt)}</span>
      </header>
      <div className="receipt__title">{order.tableName}</div>
      <div className="receipt__rule" />
      <div className="receipt__big">
        {order.quantity} × {order.productNameSnapshot}
      </div>
      {order.options.map((option) => (
        <div
          key={`${option.groupNameSnapshot}-${option.valueNameSnapshot}`}
          className="receipt__detail"
        >
          {option.groupNameSnapshot}: {option.valueNameSnapshot}
        </div>
      ))}
      {order.note === null ? null : <div className="receipt__note">Not: {order.note}</div>}
    </article>
  );
}
