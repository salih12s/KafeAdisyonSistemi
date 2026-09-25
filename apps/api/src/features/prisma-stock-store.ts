import { Prisma, type PrismaClient } from '@prisma/client';
import type { ProductRecipeResponse, StockItemDetailResponse } from '@kafe/contracts';
import { manualMovementDelta, saleConsumption, toStockItem } from './stock-calculations';
import type { StockStore } from './stock-store';
import { StoreError } from './store';

type Reader = PrismaClient | Prisma.TransactionClient;

/** PostgreSQL INTEGER üst sınırı; satış düşümü asla taşma hatasıyla kapanışı durdurmaz. */
const MAX_INT = 2_147_483_647;

const transactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isMissingRecord(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function balances(reader: Reader, ids?: string[]): Promise<Map<string, number>> {
  const rows = await reader.stockMovement.groupBy({
    by: ['stockItemId'],
    ...(ids === undefined ? {} : { where: { stockItemId: { in: ids } } }),
    _sum: { quantityDelta: true },
  });
  return new Map(rows.map((row) => [row.stockItemId, row._sum.quantityDelta ?? 0]));
}

async function readDetail(reader: Reader, id: string): Promise<StockItemDetailResponse> {
  const row = await reader.stockItem.findUnique({
    where: { id },
    include: {
      movements: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { actor: { select: { fullName: true } } },
      },
    },
  });
  if (row === null) throw new StoreError('NOT_FOUND', 'Stok kalemi bulunamadı.');
  const balance = (await balances(reader, [id])).get(id) ?? 0;
  return {
    ...toStockItem(row, balance),
    movements: row.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantityDelta: movement.quantityDelta,
      reason: movement.reason,
      checkId: movement.checkId,
      actorName: movement.actor.fullName,
      createdAt: movement.createdAt.toISOString(),
    })),
  };
}

async function readRecipe(reader: Reader, productId: string): Promise<ProductRecipeResponse> {
  const product = await reader.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (product === null) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
  const usages = await reader.productStockUsage.findMany({
    where: { productId, isActive: true },
    include: { stockItem: { select: { name: true, unit: true } } },
    orderBy: { stockItem: { name: 'asc' } },
  });
  return {
    productId,
    lines: usages.map((usage) => ({
      stockItemId: usage.stockItemId,
      stockItemName: usage.stockItem.name,
      unit: usage.stockItem.unit,
      quantityPerUnit: usage.quantityPerUnit,
    })),
  };
}

/**
 * Kapanan adisyonun reçeteye göre stok tüketimini SALE hareketi olarak yazar.
 * Adisyon kapanışıyla aynı transaction içinde çağrılır; kapanış geri alınırsa
 * stok hareketi de oluşmaz. Stok eksiye düşebilir: satış stok yüzünden engellenmez.
 */
export async function writeSaleStockMovements(
  transaction: Prisma.TransactionClient,
  checkId: string,
  actorUserId: string,
): Promise<void> {
  const items = await transaction.orderItem.findMany({
    where: { checkId },
    select: { productId: true, quantity: true, cancelledAt: true },
  });
  const productIds = [...new Set(items.map((item) => item.productId))];
  if (productIds.length === 0) return;
  const usages = await transaction.productStockUsage.findMany({
    where: { productId: { in: productIds }, isActive: true },
    select: { productId: true, stockItemId: true, quantityPerUnit: true },
  });
  const consumption = saleConsumption(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      cancelled: item.cancelledAt !== null,
    })),
    usages,
  );
  if (consumption.size === 0) return;
  await transaction.stockMovement.createMany({
    data: [...consumption].map(([stockItemId, quantity]) => ({
      stockItemId,
      type: 'SALE' as const,
      quantityDelta: -Math.min(quantity, MAX_INT),
      checkId,
      actorUserId,
    })),
  });
}

export function createPrismaStockStore(client: PrismaClient): StockStore {
  return {
    async listStockItems(includeInactive) {
      const [rows, totals] = await Promise.all([
        client.stockItem.findMany({
          where: includeInactive ? {} : { isActive: true },
          orderBy: { name: 'asc' },
        }),
        balances(client),
      ]);
      return rows.map((row) => toStockItem(row, totals.get(row.id) ?? 0));
    },

    getStockItem: (id) => readDetail(client, id),

    async createStockItem(input) {
      try {
        const created = await client.$transaction(async (transaction) => {
          const item = await transaction.stockItem.create({
            data: {
              name: input.name,
              nameKey: input.nameKey,
              unit: input.unit,
              lowStockThreshold: input.lowStockThreshold,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'STOCK_ITEM_CREATED',
              entityType: 'StockItem',
              entityId: item.id,
              metadata: { name: item.name, unit: item.unit },
            },
          });
          return item;
        });
        return toStockItem(created, 0);
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu stok kalemi adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async updateStockItem(id, input) {
      try {
        const updated = await client.$transaction(async (transaction) => {
          const item = await transaction.stockItem.update({
            where: { id },
            data: {
              name: input.name,
              nameKey: input.nameKey,
              lowStockThreshold: input.lowStockThreshold,
              isActive: input.isActive,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'STOCK_ITEM_UPDATED',
              entityType: 'StockItem',
              entityId: id,
              metadata: {
                name: item.name,
                lowStockThreshold: item.lowStockThreshold,
                isActive: item.isActive,
              },
            },
          });
          return item;
        });
        return toStockItem(updated, (await balances(client, [id])).get(id) ?? 0);
      } catch (error) {
        if (isMissingRecord(error)) throw new StoreError('NOT_FOUND', 'Stok kalemi bulunamadı.');
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu stok kalemi adı zaten kullanılıyor.');
        }
        throw error;
      }
    },

    async addStockMovement(input) {
      try {
        return await client.$transaction(async (transaction) => {
          const item = await transaction.stockItem.findUnique({
            where: { id: input.stockItemId },
            select: { id: true },
          });
          if (item === null) throw new StoreError('NOT_FOUND', 'Stok kalemi bulunamadı.');
          const current = (await balances(transaction, [item.id])).get(item.id) ?? 0;
          const quantityDelta = manualMovementDelta(input, current);
          const movement = await transaction.stockMovement.create({
            data: {
              stockItemId: item.id,
              type: input.type,
              quantityDelta,
              reason: input.reason,
              actorUserId: input.actorUserId,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'STOCK_MOVEMENT_ADDED',
              entityType: 'StockItem',
              entityId: item.id,
              metadata: { movementId: movement.id, type: input.type, quantityDelta },
            },
          });
          return readDetail(transaction, item.id);
        }, transactionOptions);
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Stok başka bir cihazda değişti; yeniden deneyin.');
        }
        throw error;
      }
    },

    getProductRecipe: (productId) => readRecipe(client, productId),

    async setProductRecipe(input) {
      const stockItemIds = input.lines.map((line) => line.stockItemId);
      if (new Set(stockItemIds).size !== stockItemIds.length) {
        throw new StoreError('VALIDATION', 'Aynı stok kalemi reçetede bir kez yer alabilir.');
      }
      try {
        return await client.$transaction(async (transaction) => {
          const product = await transaction.product.findUnique({
            where: { id: input.productId },
            select: { id: true },
          });
          if (product === null) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
          const found = await transaction.stockItem.count({ where: { id: { in: stockItemIds } } });
          if (found !== stockItemIds.length) {
            throw new StoreError('VALIDATION', 'Reçetedeki stok kalemlerinden biri bulunamadı.');
          }
          // Reçeteden çıkan satırlar silinmez, pasife alınır (ADR-011).
          await transaction.productStockUsage.updateMany({
            where: { productId: input.productId, stockItemId: { notIn: stockItemIds } },
            data: { isActive: false },
          });
          for (const line of input.lines) {
            await transaction.productStockUsage.upsert({
              where: {
                productId_stockItemId: {
                  productId: input.productId,
                  stockItemId: line.stockItemId,
                },
              },
              create: {
                productId: input.productId,
                stockItemId: line.stockItemId,
                quantityPerUnit: line.quantityPerUnit,
              },
              update: { quantityPerUnit: line.quantityPerUnit, isActive: true },
            });
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'PRODUCT_RECIPE_UPDATED',
              entityType: 'Product',
              entityId: input.productId,
              metadata: { lineCount: input.lines.length },
            },
          });
          return readRecipe(transaction, input.productId);
        }, transactionOptions);
      } catch (error) {
        if (isSerializationConflict(error) || isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Reçete başka bir cihazda değişti; yeniden deneyin.');
        }
        throw error;
      }
    },
  };
}
