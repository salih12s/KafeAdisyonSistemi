import type { Kurus } from './money.js';

export const CHECK_STATUSES = ['OPEN', 'CANCELLED'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

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
