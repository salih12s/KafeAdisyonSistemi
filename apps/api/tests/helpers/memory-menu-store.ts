import { randomUUID } from 'node:crypto';
import type {
  CategoryResponse,
  MenuResponse,
  OptionGroupResponse,
  OptionValueResponse,
  ProductResponse,
} from '@kafe/contracts';
import {
  StoreError,
  type CategoryWriteInput,
  type MenuStore,
  type OptionGroupUpdateInput,
  type OptionGroupWriteInput,
  type OptionValueUpdateInput,
  type OptionValueWriteInput,
  type ProductWriteInput,
} from '../../src/features/store';

interface MemoryCategory extends CategoryResponse {
  nameKey: string;
}

interface MemoryProduct extends ProductResponse {
  nameKey: string;
}

interface MemoryOptionGroup extends Omit<OptionGroupResponse, 'values'> {
  nameKey: string;
}

interface MemoryOptionValue extends OptionValueResponse {
  nameKey: string;
}

export interface MemoryAuditEntry {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | boolean>;
}

function bySortThenName(
  left: { sortOrder: number; name: string },
  right: { sortOrder: number; name: string },
): number {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'tr');
}

/**
 * Menü store'unun bellek içi karşılığı.
 * `MemoryStore` bu sınıfı genişletir; testler gerçek PostgreSQL'e dokunmaz.
 */
export class MemoryMenuStore implements MenuStore {
  public readonly audits: MemoryAuditEntry[] = [];
  protected readonly categories: MemoryCategory[] = [];
  protected readonly products: MemoryProduct[] = [];
  protected readonly optionGroups: MemoryOptionGroup[] = [];
  protected readonly optionValues: MemoryOptionValue[] = [];

  async listCategories(includeInactive: boolean): Promise<CategoryResponse[]> {
    return this.categories
      .filter((category) => includeInactive || category.isActive)
      .sort(bySortThenName)
      .map(publicCategory);
  }

  async createCategory(input: CategoryWriteInput): Promise<CategoryResponse> {
    if (this.categories.some((category) => category.nameKey === input.nameKey)) {
      throw new StoreError('CONFLICT', 'Bu kategori adı zaten kullanılıyor.');
    }
    const category: MemoryCategory = {
      id: randomUUID(),
      name: input.name,
      nameKey: input.nameKey,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.categories.push(category);
    this.record(input.actorUserId, 'CATEGORY_CREATED', 'Category', category.id);
    return publicCategory(category);
  }

  async updateCategory(id: string, input: CategoryWriteInput): Promise<CategoryResponse> {
    const category = this.categories.find((entry) => entry.id === id);
    if (category === undefined) throw new StoreError('NOT_FOUND', 'Kategori bulunamadı.');
    if (this.categories.some((entry) => entry.id !== id && entry.nameKey === input.nameKey)) {
      throw new StoreError('CONFLICT', 'Bu kategori adı zaten kullanılıyor.');
    }
    Object.assign(category, {
      name: input.name,
      nameKey: input.nameKey,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    this.record(input.actorUserId, 'CATEGORY_UPDATED', 'Category', category.id);
    return publicCategory(category);
  }

  async listProducts(
    categoryId: string | undefined,
    includeInactive: boolean,
  ): Promise<ProductResponse[]> {
    return this.products
      .filter(
        (product) =>
          (categoryId === undefined || product.categoryId === categoryId) &&
          (includeInactive || product.isActive),
      )
      .sort(bySortThenName)
      .map(publicProduct);
  }

  async createProduct(input: ProductWriteInput): Promise<ProductResponse> {
    this.requireCategory(input.categoryId);
    if (
      this.products.some(
        (product) => product.categoryId === input.categoryId && product.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu kategoride aynı ürün adı zaten kullanılıyor.');
    }
    const product: MemoryProduct = {
      id: randomUUID(),
      categoryId: input.categoryId,
      name: input.name,
      nameKey: input.nameKey,
      priceKurus: input.priceKurus,
      preparationArea: input.preparationArea,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.products.push(product);
    this.record(input.actorUserId, 'PRODUCT_CREATED', 'Product', product.id);
    return publicProduct(product);
  }

  async updateProduct(id: string, input: ProductWriteInput): Promise<ProductResponse> {
    const product = this.products.find((entry) => entry.id === id);
    if (product === undefined) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
    this.requireCategory(input.categoryId);
    if (
      this.products.some(
        (entry) =>
          entry.id !== id &&
          entry.categoryId === input.categoryId &&
          entry.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu kategoride aynı ürün adı zaten kullanılıyor.');
    }
    Object.assign(product, {
      categoryId: input.categoryId,
      name: input.name,
      nameKey: input.nameKey,
      priceKurus: input.priceKurus,
      preparationArea: input.preparationArea,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    this.record(input.actorUserId, 'PRODUCT_UPDATED', 'Product', product.id);
    return publicProduct(product);
  }

  async listOptionGroups(
    productId: string,
    includeInactive: boolean,
  ): Promise<OptionGroupResponse[]> {
    this.requireProduct(productId);
    return this.optionGroups
      .filter((group) => group.productId === productId && (includeInactive || group.isActive))
      .sort(bySortThenName)
      .map((group) => this.withValues(group, includeInactive));
  }

  async createOptionGroup(input: OptionGroupWriteInput): Promise<OptionGroupResponse> {
    this.requireProduct(input.productId);
    if (
      this.optionGroups.some(
        (group) => group.productId === input.productId && group.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu üründe aynı seçenek grubu adı zaten kullanılıyor.');
    }
    const group: MemoryOptionGroup = {
      id: randomUUID(),
      productId: input.productId,
      name: input.name,
      nameKey: input.nameKey,
      selectionType: input.selectionType,
      isRequired: input.isRequired,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.optionGroups.push(group);
    this.record(input.actorUserId, 'OPTION_GROUP_CREATED', 'ProductOptionGroup', group.id);
    return this.withValues(group, true);
  }

  async updateOptionGroup(id: string, input: OptionGroupUpdateInput): Promise<OptionGroupResponse> {
    const group = this.optionGroups.find((entry) => entry.id === id);
    if (group === undefined) throw new StoreError('NOT_FOUND', 'Seçenek grubu bulunamadı.');
    if (
      this.optionGroups.some(
        (entry) =>
          entry.id !== id && entry.productId === group.productId && entry.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu üründe aynı seçenek grubu adı zaten kullanılıyor.');
    }
    Object.assign(group, {
      name: input.name,
      nameKey: input.nameKey,
      selectionType: input.selectionType,
      isRequired: input.isRequired,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    this.record(input.actorUserId, 'OPTION_GROUP_UPDATED', 'ProductOptionGroup', group.id);
    return this.withValues(group, true);
  }

  async createOptionValue(input: OptionValueWriteInput): Promise<OptionValueResponse> {
    this.requireGroup(input.groupId);
    if (
      this.optionValues.some(
        (value) => value.groupId === input.groupId && value.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu grupta aynı seçenek adı zaten kullanılıyor.');
    }
    const value: MemoryOptionValue = {
      id: randomUUID(),
      groupId: input.groupId,
      name: input.name,
      nameKey: input.nameKey,
      priceDeltaKurus: input.priceDeltaKurus,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    };
    this.optionValues.push(value);
    this.record(input.actorUserId, 'OPTION_VALUE_CREATED', 'ProductOptionValue', value.id);
    return publicValue(value);
  }

  async updateOptionValue(id: string, input: OptionValueUpdateInput): Promise<OptionValueResponse> {
    const value = this.optionValues.find((entry) => entry.id === id);
    if (value === undefined) throw new StoreError('NOT_FOUND', 'Seçenek bulunamadı.');
    if (
      this.optionValues.some(
        (entry) =>
          entry.id !== id && entry.groupId === value.groupId && entry.nameKey === input.nameKey,
      )
    ) {
      throw new StoreError('CONFLICT', 'Bu grupta aynı seçenek adı zaten kullanılıyor.');
    }
    Object.assign(value, {
      name: input.name,
      nameKey: input.nameKey,
      priceDeltaKurus: input.priceDeltaKurus,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    this.record(input.actorUserId, 'OPTION_VALUE_UPDATED', 'ProductOptionValue', value.id);
    return publicValue(value);
  }

  async getMenu(): Promise<MenuResponse> {
    return {
      categories: this.categories
        .filter((category) => category.isActive)
        .sort(bySortThenName)
        .map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
          products: this.products
            .filter((product) => product.categoryId === category.id && product.isActive)
            .sort(bySortThenName)
            .map((product) => ({
              id: product.id,
              name: product.name,
              priceKurus: product.priceKurus,
              preparationArea: product.preparationArea,
              sortOrder: product.sortOrder,
              optionGroups: this.optionGroups
                .filter((group) => group.productId === product.id && group.isActive)
                .sort(bySortThenName)
                .map((group) => ({
                  id: group.id,
                  name: group.name,
                  selectionType: group.selectionType,
                  isRequired: group.isRequired,
                  sortOrder: group.sortOrder,
                  values: this.optionValues
                    .filter((value) => value.groupId === group.id && value.isActive)
                    .sort(bySortThenName)
                    .map((value) => ({
                      id: value.id,
                      name: value.name,
                      priceDeltaKurus: value.priceDeltaKurus,
                      sortOrder: value.sortOrder,
                    })),
                })),
            })),
        })),
    };
  }

  protected record(actorUserId: string, action: string, entityType: string, entityId: string): void {
    this.audits.push({ actorUserId, action, entityType, entityId });
  }

  private withValues(group: MemoryOptionGroup, includeInactive: boolean): OptionGroupResponse {
    return {
      id: group.id,
      productId: group.productId,
      name: group.name,
      selectionType: group.selectionType,
      isRequired: group.isRequired,
      sortOrder: group.sortOrder,
      isActive: group.isActive,
      values: this.optionValues
        .filter((value) => value.groupId === group.id && (includeInactive || value.isActive))
        .sort(bySortThenName)
        .map(publicValue),
    };
  }

  private requireCategory(id: string): MemoryCategory {
    const category = this.categories.find((entry) => entry.id === id);
    if (category === undefined) throw new StoreError('NOT_FOUND', 'Kategori bulunamadı.');
    return category;
  }

  private requireProduct(id: string): MemoryProduct {
    const product = this.products.find((entry) => entry.id === id);
    if (product === undefined) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
    return product;
  }

  private requireGroup(id: string): MemoryOptionGroup {
    const group = this.optionGroups.find((entry) => entry.id === id);
    if (group === undefined) throw new StoreError('NOT_FOUND', 'Seçenek grubu bulunamadı.');
    return group;
  }
}

function publicCategory(category: MemoryCategory): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
  };
}

function publicProduct(product: MemoryProduct): ProductResponse {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    priceKurus: product.priceKurus,
    preparationArea: product.preparationArea,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
  };
}

function publicValue(value: MemoryOptionValue): OptionValueResponse {
  return {
    id: value.id,
    groupId: value.groupId,
    name: value.name,
    priceDeltaKurus: value.priceDeltaKurus,
    sortOrder: value.sortOrder,
    isActive: value.isActive,
  };
}
