/** Menü yönetimi (kategori, ürün, seçenek) ve satış menüsü uçları. */
import {
  isOptionSelectionType,
  isPreparationArea,
  type CategoryResponse,
  type OptionGroupResponse,
  type OptionSelectionType,
  type OptionValueResponse,
  type PreparationArea,
  type ProductResponse,
  type MenuResponse,
} from '@kafe/contracts';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

function isCategory(value: unknown): value is CategoryResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean'
  );
}

function isProduct(value: unknown): value is ProductResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.categoryId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.priceKurus === 'number' &&
    isPreparationArea(value.preparationArea) &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean'
  );
}

function isOptionValue(value: unknown): value is OptionValueResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.groupId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.priceDeltaKurus === 'number' &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean'
  );
}

function isOptionGroup(value: unknown): value is OptionGroupResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.name === 'string' &&
    isOptionSelectionType(value.selectionType) &&
    typeof value.isRequired === 'boolean' &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean' &&
    Array.isArray(value.values) &&
    value.values.every(isOptionValue)
  );
}

export interface CategoryInput {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductInput {
  categoryId: string;
  name: string;
  priceKurus: number;
  preparationArea: PreparationArea;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionGroupInput {
  name: string;
  selectionType: OptionSelectionType;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface OptionValueInput {
  name: string;
  priceDeltaKurus: number;
  sortOrder: number;
  isActive: boolean;
}

export async function fetchCategories(includeInactive: boolean): Promise<CategoryResponse[]> {
  const categories = expectRecord(
    await requestPayload(`/api/menu/categories?includeInactive=${String(includeInactive)}`),
    'categories',
  );
  if (!Array.isArray(categories) || !categories.every(isCategory)) {
    throw new ApiError('Kategori listesi okunamadı.');
  }
  return categories;
}

export function createCategory(input: CategoryInput): Promise<unknown> {
  return requestPayload('/api/menu/categories', { method: 'POST', body: JSON.stringify(input) });
}

export function updateCategory(id: string, input: CategoryInput): Promise<unknown> {
  return requestPayload(`/api/menu/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchProducts(includeInactive: boolean): Promise<ProductResponse[]> {
  const products = expectRecord(
    await requestPayload(`/api/menu/products?includeInactive=${String(includeInactive)}`),
    'products',
  );
  if (!Array.isArray(products) || !products.every(isProduct)) {
    throw new ApiError('Ürün listesi okunamadı.');
  }
  return products;
}

export function createProduct(input: ProductInput): Promise<unknown> {
  return requestPayload('/api/menu/products', { method: 'POST', body: JSON.stringify(input) });
}

export function updateProduct(id: string, input: ProductInput): Promise<unknown> {
  return requestPayload(`/api/menu/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchOptionGroups(
  productId: string,
  includeInactive: boolean,
): Promise<OptionGroupResponse[]> {
  const groups = expectRecord(
    await requestPayload(
      `/api/menu/products/${productId}/option-groups?includeInactive=${String(includeInactive)}`,
    ),
    'optionGroups',
  );
  if (!Array.isArray(groups) || !groups.every(isOptionGroup)) {
    throw new ApiError('Seçenek listesi okunamadı.');
  }
  return groups;
}

export function createOptionGroup(productId: string, input: OptionGroupInput): Promise<unknown> {
  return requestPayload(`/api/menu/products/${productId}/option-groups`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOptionGroup(id: string, input: OptionGroupInput): Promise<unknown> {
  return requestPayload(`/api/menu/option-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createOptionValue(groupId: string, input: OptionValueInput): Promise<unknown> {
  return requestPayload(`/api/menu/option-groups/${groupId}/values`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOptionValue(id: string, input: OptionValueInput): Promise<unknown> {
  return requestPayload(`/api/menu/option-values/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- Phase 3: masa adisyonları ve siparişler ---

export function isMenu(value: unknown): value is MenuResponse {
  if (!isRecord(value) || !Array.isArray(value.categories)) return false;
  return value.categories.every(
    (category) =>
      isRecord(category) &&
      typeof category.id === 'string' &&
      typeof category.name === 'string' &&
      typeof category.sortOrder === 'number' &&
      Array.isArray(category.products) &&
      category.products.every(
        (product) =>
          isRecord(product) &&
          typeof product.id === 'string' &&
          typeof product.name === 'string' &&
          typeof product.priceKurus === 'number' &&
          isPreparationArea(product.preparationArea) &&
          typeof product.sortOrder === 'number' &&
          Array.isArray(product.optionGroups) &&
          product.optionGroups.every(
            (group) =>
              isRecord(group) &&
              typeof group.id === 'string' &&
              typeof group.name === 'string' &&
              isOptionSelectionType(group.selectionType) &&
              typeof group.isRequired === 'boolean' &&
              typeof group.sortOrder === 'number' &&
              Array.isArray(group.values) &&
              group.values.every(
                (option) =>
                  isRecord(option) &&
                  typeof option.id === 'string' &&
                  typeof option.name === 'string' &&
                  typeof option.priceDeltaKurus === 'number' &&
                  typeof option.sortOrder === 'number',
              ),
          ),
      ),
  );
}

export async function fetchSalesMenu(): Promise<MenuResponse> {
  const payload = await requestPayload('/api/menu');
  if (!isMenu(payload)) throw new ApiError('Satış menüsü okunamadı.');
  return payload;
}
