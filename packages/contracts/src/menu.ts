import type { Kurus } from './money.js';

/** Ürünün hazırlandığı yer. Sipariş akışı Phase 4'te bu ayrıma göre dağıtılır. */
export const PREPARATION_AREAS = ['KITCHEN', 'BAR'] as const;
export type PreparationArea = (typeof PREPARATION_AREAS)[number];

export const PREPARATION_AREA_LABELS: Record<PreparationArea, string> = {
  KITCHEN: 'Mutfak',
  BAR: 'Bar',
};

/** Seçenek grubundan kaç değer seçilebileceği. */
export const OPTION_SELECTION_TYPES = ['SINGLE', 'MULTIPLE'] as const;
export type OptionSelectionType = (typeof OPTION_SELECTION_TYPES)[number];

export const OPTION_SELECTION_TYPE_LABELS: Record<OptionSelectionType, string> = {
  SINGLE: 'Tek seçim',
  MULTIPLE: 'Çoklu seçim',
};

export interface CategoryResponse {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductResponse {
  id: string;
  categoryId: string;
  name: string;
  /** Tam sayı kuruş. Float kullanılmaz. */
  priceKurus: Kurus;
  preparationArea: PreparationArea;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionValueResponse {
  id: string;
  groupId: string;
  name: string;
  /** Ürün fiyatına eklenecek fark; negatif olabilir (örn. küçük boy indirimi). */
  priceDeltaKurus: Kurus;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionGroupResponse {
  id: string;
  productId: string;
  name: string;
  selectionType: OptionSelectionType;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
  values: OptionValueResponse[];
}

/** Yalnız aktif kayıtlardan oluşan, satış ekranlarının okuyacağı menü görünümü. */
export interface MenuResponse {
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    products: Array<{
      id: string;
      name: string;
      priceKurus: Kurus;
      preparationArea: PreparationArea;
      sortOrder: number;
      optionGroups: Array<{
        id: string;
        name: string;
        selectionType: OptionSelectionType;
        isRequired: boolean;
        sortOrder: number;
        values: Array<{
          id: string;
          name: string;
          priceDeltaKurus: Kurus;
          sortOrder: number;
        }>;
      }>;
    }>;
  }>;
}

export function isPreparationArea(value: unknown): value is PreparationArea {
  return typeof value === 'string' && PREPARATION_AREAS.some((area) => area === value);
}

export function isOptionSelectionType(value: unknown): value is OptionSelectionType {
  return typeof value === 'string' && OPTION_SELECTION_TYPES.some((type) => type === value);
}
