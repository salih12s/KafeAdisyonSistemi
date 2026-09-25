/** Stok kalemi, stok hareketi ve ürün reçetesi uçları. */
import {
  type ManualStockMovementType,
  type ProductRecipeResponse,
  type StockItemDetailResponse,
  type StockItemResponse,
  type StockUnit,
  STOCK_MOVEMENT_TYPES,
  STOCK_UNITS,
} from '@kafe/contracts';
import {
  ApiError,
  isRecord,
  requestPayload,
  expectRecord,
  isNullableString,
} from '../../shared/api/http';

function isStockUnit(value: unknown): value is StockUnit {
  return typeof value === 'string' && STOCK_UNITS.some((unit) => unit === value);
}

function isStockItem(value: unknown): value is StockItemResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isStockUnit(value.unit) &&
    typeof value.balance === 'number' &&
    typeof value.lowStockThreshold === 'number' &&
    typeof value.isLow === 'boolean' &&
    typeof value.isActive === 'boolean' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isStockItemDetail(value: unknown): value is StockItemDetailResponse {
  return (
    isStockItem(value) &&
    isRecord(value) &&
    Array.isArray(value.movements) &&
    value.movements.every(
      (movement) =>
        isRecord(movement) &&
        typeof movement.id === 'string' &&
        STOCK_MOVEMENT_TYPES.some((type) => type === movement.type) &&
        typeof movement.quantityDelta === 'number' &&
        isNullableString(movement.reason) &&
        isNullableString(movement.checkId) &&
        typeof movement.actorName === 'string' &&
        typeof movement.createdAt === 'string',
    )
  );
}

function readStockItemDetail(payload: unknown): StockItemDetailResponse {
  const item = expectRecord(payload, 'item');
  if (!isStockItemDetail(item)) throw new ApiError('Stok kalemi okunamadı.');
  return item;
}

export async function fetchStockItems(includeInactive = false): Promise<StockItemResponse[]> {
  const rows = expectRecord(
    await requestPayload(`/api/stock/items?includeInactive=${String(includeInactive)}`),
    'items',
  );
  if (!Array.isArray(rows) || !rows.every(isStockItem)) {
    throw new ApiError('Stok listesi okunamadı.');
  }
  return rows;
}

export async function fetchStockItem(id: string): Promise<StockItemDetailResponse> {
  return readStockItemDetail(await requestPayload(`/api/stock/items/${id}`));
}

function readStockItem(payload: unknown): StockItemResponse {
  const item = expectRecord(payload, 'item');
  if (!isStockItem(item)) throw new ApiError('Stok kalemi okunamadı.');
  return item;
}

export function createStockItem(input: {
  name: string;
  unit: StockUnit;
  lowStockThreshold: number;
}): Promise<StockItemResponse> {
  return requestPayload('/api/stock/items', { method: 'POST', body: JSON.stringify(input) }).then(
    readStockItem,
  );
}

export function updateStockItem(
  id: string,
  input: { name: string; lowStockThreshold: number; isActive: boolean },
): Promise<StockItemResponse> {
  return requestPayload(`/api/stock/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then(readStockItem);
}

export type StockMovementRequest =
  | {
      type: Exclude<ManualStockMovementType, 'ADJUSTMENT'>;
      quantity: number;
      reason: string | null;
    }
  | { type: 'ADJUSTMENT'; countedQuantity: number; reason: string };

export function addStockMovement(
  id: string,
  input: StockMovementRequest,
): Promise<StockItemDetailResponse> {
  return requestPayload(`/api/stock/items/${id}/movements`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(readStockItemDetail);
}

function isRecipe(value: unknown): value is ProductRecipeResponse {
  return (
    isRecord(value) &&
    typeof value.productId === 'string' &&
    Array.isArray(value.lines) &&
    value.lines.every(
      (line) =>
        isRecord(line) &&
        typeof line.stockItemId === 'string' &&
        typeof line.stockItemName === 'string' &&
        isStockUnit(line.unit) &&
        typeof line.quantityPerUnit === 'number',
    )
  );
}

function readRecipe(payload: unknown): ProductRecipeResponse {
  const recipe = expectRecord(payload, 'recipe');
  if (!isRecipe(recipe)) throw new ApiError('Reçete okunamadı.');
  return recipe;
}

export async function fetchProductRecipe(productId: string): Promise<ProductRecipeResponse> {
  return readRecipe(await requestPayload(`/api/stock/recipes/${productId}`));
}

export function saveProductRecipe(
  productId: string,
  lines: Array<{ stockItemId: string; quantityPerUnit: number }>,
): Promise<ProductRecipeResponse> {
  return requestPayload(`/api/stock/recipes/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ lines }),
  }).then(readRecipe);
}
