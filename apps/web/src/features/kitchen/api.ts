/** Mutfak/bar hazırlık listesi ve durum değişimi uçları. */
import {
  isPreparationArea,
  type PreparationArea,
  type CheckResponse,
  type KitchenOrderResponse,
  type OrderItemStatus,
} from '@kafe/contracts';
import { readCheck } from '../orders/api';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

function isKitchenOrder(value: unknown): value is KitchenOrderResponse {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.checkId === 'string' &&
    typeof value.tableName === 'string' &&
    typeof value.productNameSnapshot === 'string' &&
    typeof value.quantity === 'number' &&
    (value.note === null || typeof value.note === 'string') &&
    isPreparationArea(value.preparationArea) &&
    (value.preparationStatus === 'SENT' ||
      value.preparationStatus === 'PREPARING' ||
      value.preparationStatus === 'READY') &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.groupNameSnapshot === 'string' &&
        typeof option.valueNameSnapshot === 'string',
    )
  );
}

export async function fetchKitchenOrders(
  preparationArea?: PreparationArea,
): Promise<KitchenOrderResponse[]> {
  const query = preparationArea === undefined ? '' : `?preparationArea=${preparationArea}`;
  const orders = expectRecord(await requestPayload(`/api/orders/kitchen${query}`), 'orders');
  if (!Array.isArray(orders) || !orders.every(isKitchenOrder)) {
    throw new ApiError('Hazırlık siparişleri okunamadı.');
  }
  return orders;
}

export async function updateOrderItemStatus(
  itemId: string,
  status: OrderItemStatus,
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  );
}
