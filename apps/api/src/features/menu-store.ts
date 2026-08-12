import type {
  CategoryResponse,
  MenuResponse,
  OptionGroupResponse,
  OptionSelectionType,
  OptionValueResponse,
  PreparationArea,
  ProductResponse,
} from '@kafe/contracts';

/**
 * Phase 2 menü verisinin erişim sınırı.
 * `nameKey` alanları çağıran tarafta normalize edilir; store yalnız benzersizliği korur.
 */

export interface CategoryWriteInput {
  actorUserId: string;
  name: string;
  nameKey: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductWriteInput {
  actorUserId: string;
  categoryId: string;
  name: string;
  nameKey: string;
  priceKurus: number;
  preparationArea: PreparationArea;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionGroupWriteInput {
  actorUserId: string;
  productId: string;
  name: string;
  nameKey: string;
  selectionType: OptionSelectionType;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionValueWriteInput {
  actorUserId: string;
  groupId: string;
  name: string;
  nameKey: string;
  priceDeltaKurus: number;
  sortOrder: number;
  isActive: boolean;
}

/** Güncellemede grubun ürünü ve değerin grubu değişmez; bu yüzden girdide yer almaz. */
export type OptionGroupUpdateInput = Omit<OptionGroupWriteInput, 'productId'>;
export type OptionValueUpdateInput = Omit<OptionValueWriteInput, 'groupId'>;

export interface MenuStore {
  listCategories(includeInactive: boolean): Promise<CategoryResponse[]>;
  createCategory(input: CategoryWriteInput): Promise<CategoryResponse>;
  updateCategory(id: string, input: CategoryWriteInput): Promise<CategoryResponse>;

  listProducts(categoryId: string | undefined, includeInactive: boolean): Promise<ProductResponse[]>;
  createProduct(input: ProductWriteInput): Promise<ProductResponse>;
  updateProduct(id: string, input: ProductWriteInput): Promise<ProductResponse>;

  listOptionGroups(productId: string, includeInactive: boolean): Promise<OptionGroupResponse[]>;
  createOptionGroup(input: OptionGroupWriteInput): Promise<OptionGroupResponse>;
  updateOptionGroup(id: string, input: OptionGroupUpdateInput): Promise<OptionGroupResponse>;

  createOptionValue(input: OptionValueWriteInput): Promise<OptionValueResponse>;
  updateOptionValue(id: string, input: OptionValueUpdateInput): Promise<OptionValueResponse>;

  /** Yalnız aktif kategori/ürün/seçenekleri içeren satış görünümü. */
  getMenu(): Promise<MenuResponse>;
}
