import type { CheckResponse, OperationalFloorPlanResponse } from '@kafe/contracts';

export interface OpenCheckInput {
  actorUserId: string;
  tableId: string;
  guestCount: number;
}

export interface AddOrderItemInput {
  actorUserId: string;
  checkId: string;
  productId: string;
  quantity: number;
  note: string | null;
  optionValueIds: string[];
}

export interface UpdateOrderItemInput {
  actorUserId: string;
  itemId: string;
  quantity: number;
  note: string | null;
}

export interface CancelOrderItemInput {
  actorUserId: string;
  itemId: string;
  reason: string;
}

export interface OrderStore {
  getOperationalFloorPlan(): Promise<OperationalFloorPlanResponse>;
  openCheck(input: OpenCheckInput): Promise<CheckResponse>;
  getCheck(id: string): Promise<CheckResponse>;
  getOpenCheckByTable(tableId: string): Promise<CheckResponse | null>;
  addOrderItem(input: AddOrderItemInput): Promise<CheckResponse>;
  updateOrderItem(input: UpdateOrderItemInput): Promise<CheckResponse>;
  cancelOrderItem(input: CancelOrderItemInput): Promise<CheckResponse>;
}
