/** Masa planı, adisyon ve sipariş kalemi uçları. */
import {
  isPreparationArea,
  type CheckResponse,
  type OperationalFloorPlanResponse,
  type DiscountType,
} from '@kafe/contracts';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

function isOrderItemOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.optionGroupId === 'string' &&
    typeof value.optionValueId === 'string' &&
    typeof value.groupNameSnapshot === 'string' &&
    typeof value.valueNameSnapshot === 'string' &&
    typeof value.priceDeltaKurusSnapshot === 'number'
  );
}

function isOrderItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.productNameSnapshot === 'string' &&
    typeof value.categoryIdSnapshot === 'string' &&
    typeof value.categoryNameSnapshot === 'string' &&
    typeof value.unitPriceKurusSnapshot === 'number' &&
    isPreparationArea(value.preparationAreaSnapshot) &&
    (value.preparationStatus === 'SENT' ||
      value.preparationStatus === 'PREPARING' ||
      value.preparationStatus === 'READY' ||
      value.preparationStatus === 'SERVED') &&
    typeof value.quantity === 'number' &&
    (value.note === null || typeof value.note === 'string') &&
    typeof value.lineTotalKurus === 'number' &&
    typeof value.createdByUserId === 'string' &&
    typeof value.createdByName === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.cancelledAt === null || typeof value.cancelledAt === 'string') &&
    (value.cancellationReason === null || typeof value.cancellationReason === 'string') &&
    (value.cancelledByUserId === null || typeof value.cancelledByUserId === 'string') &&
    (value.cancelledByName === null || typeof value.cancelledByName === 'string') &&
    (value.complimentaryAt === null || typeof value.complimentaryAt === 'string') &&
    (value.complimentaryReason === null || typeof value.complimentaryReason === 'string') &&
    (value.complimentaryByUserId === null || typeof value.complimentaryByUserId === 'string') &&
    (value.complimentaryByName === null || typeof value.complimentaryByName === 'string') &&
    Array.isArray(value.options) &&
    value.options.every(isOrderItemOption)
  );
}

function isCheck(value: unknown): value is CheckResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.tableId === 'string' &&
    typeof value.tableName === 'string' &&
    typeof value.openedByUserId === 'string' &&
    typeof value.openedByName === 'string' &&
    typeof value.guestCount === 'number' &&
    (value.status === 'OPEN' ||
      value.status === 'CANCELLED' ||
      value.status === 'PAID' ||
      value.status === 'MERGED') &&
    typeof value.openedAt === 'string' &&
    typeof value.totalKurus === 'number' &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.paidKurus === 'number' &&
    typeof value.remainingKurus === 'number' &&
    (value.closedAt === null || typeof value.closedAt === 'string') &&
    (value.closedByUserId === null || typeof value.closedByUserId === 'string') &&
    (value.closedByName === null || typeof value.closedByName === 'string') &&
    Array.isArray(value.payments) &&
    value.payments.every(
      (payment) =>
        isRecord(payment) &&
        typeof payment.id === 'string' &&
        (payment.method === 'CASH' || payment.method === 'CARD' || payment.method === 'ACCOUNT') &&
        typeof payment.amountKurus === 'number' &&
        typeof payment.receivedByUserId === 'string' &&
        typeof payment.receivedByName === 'string' &&
        typeof payment.createdAt === 'string',
    ) &&
    Array.isArray(value.discounts) &&
    (value.mergedIntoCheckId === null || typeof value.mergedIntoCheckId === 'string') &&
    Array.isArray(value.items) &&
    value.items.every(isOrderItem)
  );
}

export function transferCheckToAccount(
  checkId: string,
  customerId: string,
): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/account-transfer`, {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  }).then(readCheck);
}

export function applyCheckDiscount(
  checkId: string,
  input: { type: DiscountType; value: number; reason: string },
): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/discounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(readCheck);
}

export function makeItemComplimentary(itemId: string, reason: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/items/${itemId}/complimentary`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }).then(readCheck);
}

export function moveCheck(checkId: string, targetTableId: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetTableId }),
  }).then(readCheck);
}

export function mergeChecks(targetCheckId: string, sourceCheckId: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${targetCheckId}/merge`, {
    method: 'POST',
    body: JSON.stringify({ sourceCheckId }),
  }).then(readCheck);
}

function isOperationalFloorPlan(value: unknown): value is OperationalFloorPlanResponse {
  if (!isRecord(value) || !Array.isArray(value.areas)) return false;
  return value.areas.every(
    (area) =>
      isRecord(area) &&
      typeof area.id === 'string' &&
      typeof area.name === 'string' &&
      typeof area.sortOrder === 'number' &&
      Array.isArray(area.tables) &&
      area.tables.every(
        (table) =>
          isRecord(table) &&
          typeof table.id === 'string' &&
          typeof table.name === 'string' &&
          (table.capacity === null || typeof table.capacity === 'number') &&
          typeof table.sortOrder === 'number' &&
          (table.openCheck === null ||
            (isRecord(table.openCheck) &&
              typeof table.openCheck.id === 'string' &&
              typeof table.openCheck.guestCount === 'number' &&
              typeof table.openCheck.openedAt === 'string' &&
              typeof table.openCheck.totalKurus === 'number')),
      ),
  );
}

export async function fetchOperationalFloorPlan(): Promise<OperationalFloorPlanResponse> {
  const payload = await requestPayload('/api/orders/floor-plan');
  if (!isOperationalFloorPlan(payload)) throw new ApiError('Masa durumları okunamadı.');
  return payload;
}

export function readCheck(payload: unknown): CheckResponse {
  const check = expectRecord(payload, 'check');
  if (!isCheck(check)) throw new ApiError('Adisyon bilgisi okunamadı.');
  return check;
}

export async function fetchCheck(id: string): Promise<CheckResponse> {
  return readCheck(await requestPayload(`/api/orders/checks/${id}`));
}

export async function openTableCheck(tableId: string, guestCount: number): Promise<CheckResponse> {
  return readCheck(
    await requestPayload('/api/orders/checks', {
      method: 'POST',
      body: JSON.stringify({ tableId, guestCount }),
    }),
  );
}

export async function addOrderItem(
  checkId: string,
  input: { productId: string; quantity: number; note: string | null; optionValueIds: string[] },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/checks/${checkId}/items`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateOrderItem(
  itemId: string,
  input: { quantity: number; note: string | null },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function cancelOrderItem(itemId: string, reason: string): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}
