import type { IdentityStore } from '../modules/identity/identity-store';
import type { FloorStore } from '../modules/floor/floor-store';
import type { MenuStore } from '../modules/menu/menu-store';
import type { OrderStore } from '../modules/orders/order-store';
import type { AccountStore } from '../modules/accounts/account-store';
import type { ReportStore } from '../modules/reports/report-store';
import type { CashStore } from '../modules/cash/cash-store';
import type { StockStore } from '../modules/stock/stock-store';

// Modüllerin store tipleri tek giriş noktasından da okunabilir.
export * from '../modules/identity/identity-store';
export * from '../modules/floor/floor-store';
export * from '../modules/menu/menu-store';
export * from '../modules/orders/order-store';
export * from '../modules/accounts/account-store';
export * from '../modules/reports/report-store';
export * from '../modules/cash/cash-store';
export * from '../modules/stock/stock-store';

export type StoreErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'LAST_OWNER'
  | 'SELF_DEACTIVATE'
  | 'ALREADY_INITIALIZED';

export class StoreError extends Error {
  constructor(
    public readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

/**
 * Uygulamanın tüm kalıcılık sınırı. Her modül kendi arayüzünü tanımlar;
 * üretimde Prisma, testlerde bellek içi uygulama bu birleşimi sağlar.
 */
export interface AppStore
  extends
    IdentityStore,
    FloorStore,
    MenuStore,
    OrderStore,
    AccountStore,
    ReportStore,
    CashStore,
    StockStore {}
