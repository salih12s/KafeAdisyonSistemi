import { LOCALE } from './common.js';

/**
 * Stok miktarları her zaman en küçük birimde tam sayı tutulur (adet, gram,
 * mililitre). Para gibi stokta da Float kullanılmaz.
 */
export const STOCK_UNITS = ['PIECE', 'GRAM', 'MILLILITER'] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const STOCK_UNIT_LABELS: Record<StockUnit, string> = {
  PIECE: 'Adet',
  GRAM: 'Gram',
  MILLILITER: 'Mililitre',
};

export const STOCK_MOVEMENT_TYPES = ['PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'Alım',
  SALE: 'Satış',
  WASTE: 'Fire',
  ADJUSTMENT: 'Sayım düzeltmesi',
};

/** Elle girilebilen hareketler; satış hareketi yalnız adisyon kapanışında oluşur. */
export const MANUAL_STOCK_MOVEMENT_TYPES = ['PURCHASE', 'WASTE', 'ADJUSTMENT'] as const;
export type ManualStockMovementType = (typeof MANUAL_STOCK_MOVEMENT_TYPES)[number];

export interface StockItemResponse {
  id: string;
  name: string;
  unit: StockUnit;
  /** Hareketlerden türetilen güncel miktar; en küçük birimde. */
  balance: number;
  lowStockThreshold: number;
  isLow: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementResponse {
  id: string;
  type: StockMovementType;
  /** İşaretli miktar: giriş pozitif, çıkış negatif. */
  quantityDelta: number;
  reason: string | null;
  checkId: string | null;
  actorName: string;
  createdAt: string;
}

export interface StockItemDetailResponse extends StockItemResponse {
  movements: StockMovementResponse[];
}

export interface RecipeLineResponse {
  stockItemId: string;
  stockItemName: string;
  unit: StockUnit;
  /** Bir adet ürün satıldığında düşülecek miktar. */
  quantityPerUnit: number;
}

export interface ProductRecipeResponse {
  productId: string;
  lines: RecipeLineResponse[];
}

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

/** 1500 gram -> "1,5 kg"; 750 ml -> "750 ml"; 12 adet -> "12 adet". */
export function formatStockQuantity(unit: StockUnit, quantity: number): string {
  if (unit === 'PIECE') return `${numberFormat.format(quantity)} adet`;
  const [small, large] = unit === 'GRAM' ? ['g', 'kg'] : ['ml', 'L'];
  return Math.abs(quantity) >= 1000
    ? `${numberFormat.format(quantity / 1000)} ${large}`
    : `${numberFormat.format(quantity)} ${small}`;
}
