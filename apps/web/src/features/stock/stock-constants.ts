/** Stok ekranının sorgu anahtarı ve birim kısaltmaları. */
import { STOCK_UNITS, type StockUnit } from '@kafe/contracts';

export const ITEMS_KEY = ['stock', 'items'] as const;

export const UNIT_SHORT: Record<StockUnit, string> = { PIECE: 'adet', GRAM: 'g', MILLILITER: 'ml' };

export function isStockUnit(value: string): value is StockUnit {
  return STOCK_UNITS.some((unit) => unit === value);
}
