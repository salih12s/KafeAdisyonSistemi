import type { Kurus } from './money.js';
import type { PreparationArea } from './menu.js';

export const CHECK_STATUSES = ['OPEN', 'CANCELLED', 'PAID', 'MERGED'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'ACCOUNT'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Nakit',
  CARD: 'Kart',
  ACCOUNT: 'Cari',
};

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface CheckDiscountResponse {
  id: string;
  type: DiscountType;
  value: number;
  amountKurus: Kurus;
  reason: string;
  appliedByUserId: string;
  appliedByName: string;
  createdAt: string;
}

export const PAYMENT_SPLIT_MODES = ['AMOUNT', 'ITEMS', 'GUESTS'] as const;
export type PaymentSplitMode = (typeof PAYMENT_SPLIT_MODES)[number];

export const ORDER_ITEM_STATUSES = ['SENT', 'PREPARING', 'READY', 'SERVED'] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  SENT: 'Yeni',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  SERVED: 'Servis edildi',
};

export const ORDER_REALTIME_EVENT = 'orders:changed' as const;
export const ORDER_REALTIME_EVENT_TYPES = [
  'ITEM_ADDED',
  'ITEM_UPDATED',
  'ITEM_CANCELLED',
  'ITEM_STATUS_CHANGED',
  'PAYMENT_ADDED',
  'CHECK_CLOSED',
  'CHECK_ADJUSTED',
  'TABLE_MOVED',
  'CHECK_MERGED',
  'ACCOUNT_CHANGED',
] as const;
export type OrderRealtimeEventType = (typeof ORDER_REALTIME_EVENT_TYPES)[number];
export type OrderItemRealtimeEventType = Exclude<
  OrderRealtimeEventType,
  | 'PAYMENT_ADDED'
  | 'CHECK_CLOSED'
  | 'CHECK_ADJUSTED'
  | 'TABLE_MOVED'
  | 'CHECK_MERGED'
  | 'ACCOUNT_CHANGED'
>;

export interface OrderItemRealtimeEvent {
  type: OrderItemRealtimeEventType;
  checkId: string;
  itemId: string;
  preparationArea: PreparationArea;
}

export type OrderRealtimeEvent =
  | OrderItemRealtimeEvent
  | {
      type: 'PAYMENT_ADDED' | 'CHECK_CLOSED' | 'CHECK_ADJUSTED' | 'TABLE_MOVED';
      checkId: string;
    }
  | { type: 'CHECK_MERGED'; checkId: string; sourceCheckId: string }
  | { type: 'ACCOUNT_CHANGED'; customerId: string; checkId?: string };

export interface PaymentResponse {
  id: string;
  method: PaymentMethod;
  amountKurus: Kurus;
  receivedByUserId: string;
  receivedByName: string;
  createdAt: string;
}

export interface PaymentSplitShare {
  label: string;
  amountKurus: Kurus;
  itemIds: string[];
}

export interface PaymentSplitResponse {
  mode: PaymentSplitMode;
  totalKurus: Kurus;
  shares: PaymentSplitShare[];
}

export interface OrderItemOptionResponse {
  id: string;
  optionGroupId: string;
  optionValueId: string;
  groupNameSnapshot: string;
  valueNameSnapshot: string;
  priceDeltaKurusSnapshot: Kurus;
}

export interface OrderItemResponse {
  id: string;
  productId: string;
  productNameSnapshot: string;
  unitPriceKurusSnapshot: Kurus;
  preparationAreaSnapshot: PreparationArea;
  preparationStatus: OrderItemStatus;
  quantity: number;
  note: string | null;
  lineTotalKurus: Kurus;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancelledByUserId: string | null;
  cancelledByName: string | null;
  complimentaryAt: string | null;
  complimentaryReason: string | null;
  complimentaryByUserId: string | null;
  complimentaryByName: string | null;
  options: OrderItemOptionResponse[];
}

export interface KitchenOrderResponse {
  itemId: string;
  checkId: string;
  tableName: string;
  productNameSnapshot: string;
  quantity: number;
  note: string | null;
  preparationArea: PreparationArea;
  preparationStatus: OrderItemStatus;
  createdAt: string;
  options: Array<{
    groupNameSnapshot: string;
    valueNameSnapshot: string;
  }>;
}

export interface CheckResponse {
  id: string;
  tableId: string;
  tableName: string;
  openedByUserId: string;
  openedByName: string;
  guestCount: number;
  status: CheckStatus;
  openedAt: string;
  totalKurus: Kurus;
  discountTotalKurus: Kurus;
  paidKurus: Kurus;
  remainingKurus: Kurus;
  closedAt: string | null;
  closedByUserId: string | null;
  closedByName: string | null;
  payments: PaymentResponse[];
  discounts: CheckDiscountResponse[];
  mergedIntoCheckId: string | null;
  items: OrderItemResponse[];
}

export interface OperationalFloorPlanResponse {
  areas: Array<{
    id: string;
    name: string;
    sortOrder: number;
    tables: Array<{
      id: string;
      name: string;
      capacity: number | null;
      sortOrder: number;
      openCheck: null | {
        id: string;
        guestCount: number;
        openedAt: string;
        totalKurus: Kurus;
      };
    }>;
  }>;
}
