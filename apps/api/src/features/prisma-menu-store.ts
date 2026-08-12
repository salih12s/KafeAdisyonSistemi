import {
  Prisma,
  type Category,
  type PrismaClient,
  type Product,
  type ProductOptionGroup,
  type ProductOptionValue,
} from '@prisma/client';
import type {
  CategoryResponse,
  MenuResponse,
  OptionGroupResponse,
  OptionValueResponse,
  ProductResponse,
} from '@kafe/contracts';
import { StoreError } from './store';
import type {
  CategoryWriteInput,
  MenuStore,
  OptionGroupUpdateInput,
  OptionGroupWriteInput,
  OptionValueUpdateInput,
  OptionValueWriteInput,
  ProductWriteInput,
} from './menu-store';

const BY_SORT_THEN_NAME = [{ sortOrder: 'asc' }, { name: 'asc' }] as const;

function toCategory(row: Category): CategoryResponse {
  return { id: row.id, name: row.name, sortOrder: row.sortOrder, isActive: row.isActive };
}

function toProduct(row: Product): ProductResponse {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    priceKurus: row.priceKurus,
    preparationArea: row.preparationArea,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function toOptionValue(row: ProductOptionValue): OptionValueResponse {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    priceDeltaKurus: row.priceDeltaKurus,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function toOptionGroup(
  row: ProductOptionGroup & { values: ProductOptionValue[] },
): OptionGroupResponse {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    selectionType: row.selectionType,
    isRequired: row.isRequired,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    values: row.values.map(toOptionValue),
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isMissingRecord(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/** Menü verisini PostgreSQL üzerinde yöneten store. Hiçbir kayıt silinmez. */
export function createPrismaMenuStore(client: PrismaClient): MenuStore {
  return {
    async listCategories(includeInactive: boolean): Promise<CategoryResponse[]> {
      const rows = await client.category.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [...BY_SORT_THEN_NAME],
      });
      return rows.map(toCategory);
    },

    async createCategory(input: CategoryWriteInput): Promise<CategoryResponse> {
      try {
        const created = await client.$transaction(async (transaction) => {
          const category = await transaction.category.create({
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CATEGORY_CREATED',
              entityType: 'Category',
              entityId: category.id,
              metadata: { name: category.name },
            },
          });
          return category;
        });
        return toCategory(created);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kategori adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateCategory(id: string, input: CategoryWriteInput): Promise<CategoryResponse> {
      try {
        const updated = await client.$transaction(async (transaction) => {
          const category = await transaction.category.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CATEGORY_UPDATED',
              entityType: 'Category',
              entityId: category.id,
              metadata: { name: category.name, isActive: category.isActive },
            },
          });
          return category;
        });
        return toCategory(updated);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kategori adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Kategori bulunamadı.');
        throw error;
      }
    },

    async listProducts(
      categoryId: string | undefined,
      includeInactive: boolean,
    ): Promise<ProductResponse[]> {
      const rows = await client.product.findMany({
        where: {
          ...(categoryId === undefined ? {} : { categoryId }),
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [...BY_SORT_THEN_NAME],
      });
      return rows.map(toProduct);
    },

    async createProduct(input: ProductWriteInput): Promise<ProductResponse> {
      try {
        const created = await client.$transaction(async (transaction) => {
          const category = await transaction.category.findUnique({
            where: { id: input.categoryId },
          });
          if (category === null) throw new StoreError('NOT_FOUND', 'Kategori bulunamadı.');

          const product = await transaction.product.create({
            data: {
              categoryId: input.categoryId,
              name: input.name,
              nameKey: input.nameKey,
              priceKurus: input.priceKurus,
              preparationArea: input.preparationArea,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'PRODUCT_CREATED',
              entityType: 'Product',
              entityId: product.id,
              metadata: { name: product.name, priceKurus: product.priceKurus },
            },
          });
          return product;
        });
        return toProduct(created);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kategoride aynı ürün adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateProduct(id: string, input: ProductWriteInput): Promise<ProductResponse> {
      try {
        const updated = await client.$transaction(async (transaction) => {
          const category = await transaction.category.findUnique({
            where: { id: input.categoryId },
          });
          if (category === null) throw new StoreError('NOT_FOUND', 'Kategori bulunamadı.');

          const product = await transaction.product.update({
            where: { id },
            data: {
              categoryId: input.categoryId,
              name: input.name,
              nameKey: input.nameKey,
              priceKurus: input.priceKurus,
              preparationArea: input.preparationArea,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'PRODUCT_UPDATED',
              entityType: 'Product',
              entityId: product.id,
              metadata: {
                name: product.name,
                priceKurus: product.priceKurus,
                isActive: product.isActive,
              },
            },
          });
          return product;
        });
        return toProduct(updated);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu kategoride aynı ürün adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
        throw error;
      }
    },

    async listOptionGroups(
      productId: string,
      includeInactive: boolean,
    ): Promise<OptionGroupResponse[]> {
      const product = await client.product.findUnique({ where: { id: productId } });
      if (product === null) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');

      const rows = await client.productOptionGroup.findMany({
        where: { productId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [...BY_SORT_THEN_NAME],
        include: {
          values: {
            where: includeInactive ? {} : { isActive: true },
            orderBy: [...BY_SORT_THEN_NAME],
          },
        },
      });
      return rows.map(toOptionGroup);
    },

    async createOptionGroup(input: OptionGroupWriteInput): Promise<OptionGroupResponse> {
      try {
        const created = await client.$transaction(async (transaction) => {
          const product = await transaction.product.findUnique({ where: { id: input.productId } });
          if (product === null) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');

          const group = await transaction.productOptionGroup.create({
            data: {
              productId: input.productId,
              name: input.name,
              nameKey: input.nameKey,
              selectionType: input.selectionType,
              isRequired: input.isRequired,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
            include: { values: true },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'OPTION_GROUP_CREATED',
              entityType: 'ProductOptionGroup',
              entityId: group.id,
              metadata: { name: group.name, productId: group.productId },
            },
          });
          return group;
        });
        return toOptionGroup(created);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu üründe aynı seçenek grubu adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateOptionGroup(
      id: string,
      input: OptionGroupUpdateInput,
    ): Promise<OptionGroupResponse> {
      try {
        const updated = await client.$transaction(async (transaction) => {
          const group = await transaction.productOptionGroup.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              selectionType: input.selectionType,
              isRequired: input.isRequired,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
            include: { values: { orderBy: [...BY_SORT_THEN_NAME] } },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'OPTION_GROUP_UPDATED',
              entityType: 'ProductOptionGroup',
              entityId: group.id,
              metadata: { name: group.name, isActive: group.isActive },
            },
          });
          return group;
        });
        return toOptionGroup(updated);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu üründe aynı seçenek grubu adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Seçenek grubu bulunamadı.');
        throw error;
      }
    },

    async createOptionValue(input: OptionValueWriteInput): Promise<OptionValueResponse> {
      try {
        const created = await client.$transaction(async (transaction) => {
          const group = await transaction.productOptionGroup.findUnique({
            where: { id: input.groupId },
          });
          if (group === null) throw new StoreError('NOT_FOUND', 'Seçenek grubu bulunamadı.');

          const value = await transaction.productOptionValue.create({
            data: {
              groupId: input.groupId,
              name: input.name,
              nameKey: input.nameKey,
              priceDeltaKurus: input.priceDeltaKurus,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'OPTION_VALUE_CREATED',
              entityType: 'ProductOptionValue',
              entityId: value.id,
              metadata: { name: value.name, groupId: value.groupId },
            },
          });
          return value;
        });
        return toOptionValue(created);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu grupta aynı seçenek adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateOptionValue(
      id: string,
      input: OptionValueUpdateInput,
    ): Promise<OptionValueResponse> {
      try {
        const updated = await client.$transaction(async (transaction) => {
          const value = await transaction.productOptionValue.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              priceDeltaKurus: input.priceDeltaKurus,
              sortOrder: input.sortOrder,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'OPTION_VALUE_UPDATED',
              entityType: 'ProductOptionValue',
              entityId: value.id,
              metadata: { name: value.name, isActive: value.isActive },
            },
          });
          return value;
        });
        return toOptionValue(updated);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu grupta aynı seçenek adı zaten kullanılıyor.');
        }
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Seçenek bulunamadı.');
        throw error;
      }
    },

    async getMenu(): Promise<MenuResponse> {
      const categories = await client.category.findMany({
        where: { isActive: true },
        orderBy: [...BY_SORT_THEN_NAME],
        include: {
          products: {
            where: { isActive: true },
            orderBy: [...BY_SORT_THEN_NAME],
            include: {
              optionGroups: {
                where: { isActive: true },
                orderBy: [...BY_SORT_THEN_NAME],
                include: {
                  values: { where: { isActive: true }, orderBy: [...BY_SORT_THEN_NAME] },
                },
              },
            },
          },
        },
      });

      return {
        categories: categories.map((category) => ({
          id: category.id,
          name: category.name,
          sortOrder: category.sortOrder,
          products: category.products.map((product) => ({
            id: product.id,
            name: product.name,
            priceKurus: product.priceKurus,
            preparationArea: product.preparationArea,
            sortOrder: product.sortOrder,
            optionGroups: product.optionGroups.map((group) => ({
              id: group.id,
              name: group.name,
              selectionType: group.selectionType,
              isRequired: group.isRequired,
              sortOrder: group.sortOrder,
              values: group.values.map((value) => ({
                id: value.id,
                name: value.name,
                priceDeltaKurus: value.priceDeltaKurus,
                sortOrder: value.sortOrder,
              })),
            })),
          })),
        })),
      };
    },
  };
}
