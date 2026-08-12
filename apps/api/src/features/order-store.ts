import type {
  CheckResponse,
  KitchenOrderResponse,
  OperationalFloorPlanResponse,
  OrderItemStatus,
  PaymentMethod,
  PaymentSplitResponse,
  PreparationArea,
} from '@kafe/contracts';

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

export interface UpdateOrderItemStatusInput {
  actorUserId: string;
  itemId: string;
  status: OrderItemStatus;
}

export interface AddPaymentInput {
  actorUserId: string;
  checkId: string;
  method: PaymentMethod;
  amountKurus: number;
  cashReceivedKurus: number | null;
}

export type SplitPaymentInput =
  | { actorUserId: string; checkId: string; mode: 'AMOUNT'; amountKurus: number }
  | { actorUserId: string; checkId: string; mode: 'ITEMS'; itemIds: string[] }
  | { actorUserId: string; checkId: string; mode: 'GUESTS' };

export interface CloseCheckInput {
  actorUserId: string;
  checkId: string;
}

export interface OrderStore {
  getOperationalFloorPlan(): Promise<OperationalFloorPlanResponse>;
  openCheck(input: OpenCheckInput): Promise<CheckResponse>;
  getCheck(id: string): Promise<CheckResponse>;
  getOpenCheckByTable(tableId: string): Promise<CheckResponse | null>;
  addOrderItem(input: AddOrderItemInput): Promise<CheckResponse>;
  updateOrderItem(input: UpdateOrderItemInput): Promise<CheckResponse>;
  cancelOrderItem(input: CancelOrderItemInput): Promise<CheckResponse>;
  listKitchenOrders(preparationArea?: PreparationArea): Promise<KitchenOrderResponse[]>;
  updateOrderItemStatus(input: UpdateOrderItemStatusInput): Promise<CheckResponse>;
  addPayment(input: AddPaymentInput): Promise<CheckResponse>;
  previewPaymentSplit(input: SplitPaymentInput): Promise<PaymentSplitResponse>;
  closeCheck(input: CloseCheckInput): Promise<CheckResponse>;
}
