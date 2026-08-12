import type { Kurus } from './money.js';
import type { PreparationArea } from './menu.js';

export const CHECK_STATUSES = ['OPEN', 'CANCELLED'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

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
] as const;
export type OrderRealtimeEventType = (typeof ORDER_REALTIME_EVENT_TYPES)[number];

export interface OrderRealtimeEvent {
  type: OrderRealtimeEventType;
  checkId: string;
  itemId: string;
  preparationArea: PreparationArea;
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
