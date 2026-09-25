import type { StockItemResponse, StockUnit } from '@kafe/contracts';
import { StoreError } from '../../shared/store';
import type { StockMovementInput } from './stock-store';

export interface StockItemSource {
  id: string;
  name: string;
  unit: StockUnit;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toStockItem(source: StockItemSource, balance: number): StockItemResponse {
  return {
    id: source.id,
    name: source.name,
    unit: source.unit,
    balance,
    lowStockThreshold: source.lowStockThreshold,
    isLow: source.isActive && balance <= source.lowStockThreshold,
    isActive: source.isActive,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

/** Elle girilen hareketin işaretli miktarını hesaplar. */
export function manualMovementDelta(input: StockMovementInput, currentBalance: number): number {
  if (input.type !== 'ADJUSTMENT') {
    return input.type === 'PURCHASE' ? input.quantity : -input.quantity;
  }
  const delta = input.countedQuantity - currentBalance;
  if (delta === 0) {
    throw new StoreError('VALIDATION', 'Sayılan miktar mevcut stokla aynı; düzeltme gerekmez.');
  }
  return delta;
}

/**
 * Kapanan adisyonun stok tüketimi: iptal edilmemiş her kalem (ikramlar dahil,
 * çünkü ürün yine hazırlanmıştır) × reçetedeki birim miktar. Aynı stok kalemi
 * tek hareket olarak toplanır.
 */
export function saleConsumption(
  items: ReadonlyArray<{ productId: string; quantity: number; cancelled: boolean }>,
  usages: ReadonlyArray<{ productId: string; stockItemId: string; quantityPerUnit: number }>,
): Map<string, number> {
  const soldByProduct = new Map<string, number>();
  for (const item of items) {
    if (item.cancelled) continue;
    soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const consumption = new Map<string, number>();
  for (const usage of usages) {
    const sold = soldByProduct.get(usage.productId) ?? 0;
    if (sold === 0) continue;
    consumption.set(
      usage.stockItemId,
      (consumption.get(usage.stockItemId) ?? 0) + sold * usage.quantityPerUnit,
    );
  }
  return consumption;
}
