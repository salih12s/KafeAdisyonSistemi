import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  CheckResponse,
  KitchenOrderResponse,
  OperationalFloorPlanResponse,
  OrderItemResponse,
  OrderItemStatus,
} from '@kafe/contracts';
import { StoreError } from './store';
import type {
  AddOrderItemInput,
  CancelOrderItemInput,
  OpenCheckInput,
  OrderStore,
  UpdateOrderItemInput,
  UpdateOrderItemStatusInput,
} from './order-store';

const MAX_POSTGRES_INT = 2_147_483_647;
const CHECK_INCLUDE = {
  table: true,
  openedBy: true,
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      createdBy: true,
      cancelledBy: true,
      options: { orderBy: { id: 'asc' } },
    },
  },
} satisfies Prisma.CheckInclude;

type FullCheck = Prisma.CheckGetPayload<{ include: typeof CHECK_INCLUDE }>;

function toOrderItem(row: FullCheck['items'][number]): OrderItemResponse {
  return {
    id: row.id,
    productId: row.productId,
    productNameSnapshot: row.productNameSnapshot,
    unitPriceKurusSnapshot: row.unitPriceKurusSnapshot,
    preparationAreaSnapshot: row.preparationAreaSnapshot,
    preparationStatus: row.preparationStatus,
    quantity: row.quantity,
    note: row.note,
    lineTotalKurus: row.lineTotalKurus,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdBy.fullName,
    createdAt: row.createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    cancelledByUserId: row.cancelledByUserId,
    cancelledByName: row.cancelledBy?.fullName ?? null,
    options: row.options.map((option) => ({
      id: option.id,
      optionGroupId: option.optionGroupId,
      optionValueId: option.optionValueId,
      groupNameSnapshot: option.groupNameSnapshot,
      valueNameSnapshot: option.valueNameSnapshot,
      priceDeltaKurusSnapshot: option.priceDeltaKurusSnapshot,
    })),
  };
}

const NEXT_STATUS: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  SENT: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
};

const STATUS_AUDIT_ACTION: Record<Exclude<OrderItemStatus, 'SENT'>, string> = {
  PREPARING: 'ORDER_ITEM_PREPARING',
  READY: 'ORDER_ITEM_READY',
  SERVED: 'ORDER_ITEM_SERVED',
};

function toCheck(row: FullCheck): CheckResponse {
  return {
    id: row.id,
    tableId: row.tableId,
    tableName: row.table.name,
    openedByUserId: row.openedByUserId,
    openedByName: row.openedBy.fullName,
    guestCount: row.guestCount,
    status: row.status,
    openedAt: row.openedAt.toISOString(),
    totalKurus: row.totalKurus,
    items: row.items.map(toOrderItem),
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function requireOpenCheck(
  transaction: Prisma.TransactionClient,
  id: string,
): Promise<{ id: string }> {
  const check = await transaction.check.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (check === null) throw new StoreError('NOT_FOUND', 'Adisyon bulunamadı.');
  if (check.status !== 'OPEN') throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
  return check;
}

async function updateTotal(transaction: Prisma.TransactionClient, checkId: string): Promise<void> {
  const result = await transaction.orderItem.aggregate({
    where: { checkId, cancelledAt: null },
    _sum: { lineTotalKurus: true },
  });
  await transaction.check.update({
    where: { id: checkId },
    data: { totalKurus: result._sum.lineTotalKurus ?? 0 },
  });
}

async function readCheck(
  client: PrismaClient | Prisma.TransactionClient,
  id: string,
): Promise<CheckResponse> {
  const check = await client.check.findUnique({ where: { id }, include: CHECK_INCLUDE });
  if (check === null) throw new StoreError('NOT_FOUND', 'Adisyon bulunamadı.');
  return toCheck(check);
}

function transactionOptions() {
  return { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;
}

/** Phase 3 adisyon işlemleri. Fiyatlar ve toplamlar yalnız sunucuda hesaplanır. */
export function createPrismaOrderStore(client: PrismaClient): OrderStore {
  return {
    async getOperationalFloorPlan(): Promise<OperationalFloorPlanResponse> {
      const areas = await client.diningArea.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          tables: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              checks: {
                where: { status: 'OPEN' },
                orderBy: { openedAt: 'desc' },
                take: 1,
                select: { id: true, guestCount: true, openedAt: true, totalKurus: true },
              },
            },
          },
        },
      });
      return {
        areas: areas.map((area) => ({
          id: area.id,
          name: area.name,
          sortOrder: area.sortOrder,
          tables: area.tables.map((table) => {
            const check = table.checks[0];
            return {
              id: table.id,
              name: table.name,
              capacity: table.capacity,
              sortOrder: table.sortOrder,
              openCheck:
                check === undefined
                  ? null
                  : {
                      id: check.id,
                      guestCount: check.guestCount,
                      openedAt: check.openedAt.toISOString(),
                      totalKurus: check.totalKurus,
                    },
            };
          }),
        })),
      };
    },

    async openCheck(input: OpenCheckInput): Promise<CheckResponse> {
      try {
        return await client.$transaction(async (transaction) => {
          const table = await transaction.cafeTable.findUnique({
            where: { id: input.tableId },
            include: { area: true },
          });
          if (table === null) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
          if (!table.isActive || !table.area.isActive) {
            throw new StoreError('CONFLICT', 'Pasif bir masa adisyona açılamaz.');
          }
          const existing = await transaction.check.findFirst({
            where: { tableId: table.id, status: 'OPEN' },
            select: { id: true },
          });
          if (existing !== null) {
            throw new StoreError('CONFLICT', 'Bu masada zaten açık bir adisyon var.');
          }

          const check = await transaction.check.create({
            data: {
              tableId: table.id,
              openedByUserId: input.actorUserId,
              guestCount: input.guestCount,
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'CHECK_OPENED',
              entityType: 'Check',
              entityId: check.id,
              metadata: { tableId: table.id, guestCount: input.guestCount },
            },
          });
          return readCheck(transaction, check.id);
        }, transactionOptions());
      } catch (error) {
        if (isUniqueConstraint(error)) {
          throw new StoreError('CONFLICT', 'Bu masada zaten açık bir adisyon var.');
        }
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Masa durumu değişti; yeniden deneyin.');
        }
        throw error;
      }
    },

    getCheck(id: string): Promise<CheckResponse> {
      return readCheck(client, id);
    },

    async getOpenCheckByTable(tableId: string): Promise<CheckResponse | null> {
      const table = await client.cafeTable.findUnique({
        where: { id: tableId },
        select: { id: true },
      });
      if (table === null) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
      const check = await client.check.findFirst({
        where: { tableId, status: 'OPEN' },
        include: CHECK_INCLUDE,
      });
      return check === null ? null : toCheck(check);
    },

    async addOrderItem(input: AddOrderItemInput): Promise<CheckResponse> {
      try {
        return await client.$transaction(async (transaction) => {
          await requireOpenCheck(transaction, input.checkId);
          const product = await transaction.product.findUnique({
            where: { id: input.productId },
            include: {
              category: true,
              optionGroups: {
                where: { isActive: true },
                include: { values: { where: { isActive: true } } },
              },
            },
          });
          if (product === null) throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
          if (!product.isActive || !product.category.isActive) {
            throw new StoreError('VALIDATION', 'Bu ürün satışa açık değil.');
          }

          const uniqueValueIds = new Set(input.optionValueIds);
          if (uniqueValueIds.size !== input.optionValueIds.length) {
            throw new StoreError('VALIDATION', 'Aynı seçenek birden fazla kez seçilemez.');
          }

          const activeValues = new Map(
            product.optionGroups.flatMap((group) =>
              group.values.map((value) => [value.id, { group, value }] as const),
            ),
          );
          const selected = input.optionValueIds.map((id) => {
            const option = activeValues.get(id);
            if (option === undefined) {
              throw new StoreError('VALIDATION', 'Seçilen seçenek bu ürün için geçerli değil.');
            }
            return option;
          });

          for (const group of product.optionGroups) {
            const count = selected.filter((entry) => entry.group.id === group.id).length;
            if (group.isRequired && count === 0) {
              throw new StoreError('VALIDATION', `${group.name} seçimi zorunludur.`);
            }
            if (group.selectionType === 'SINGLE' && count > 1) {
              throw new StoreError(
                'VALIDATION',
                `${group.name} grubundan yalnız bir seçim yapılabilir.`,
              );
            }
          }

          const optionTotal = selected.reduce(
            (total, entry) => total + entry.value.priceDeltaKurus,
            0,
          );
          const unitTotal = product.priceKurus + optionTotal;
          const lineTotal = unitTotal * input.quantity;
          if (!Number.isSafeInteger(lineTotal) || unitTotal < 0 || lineTotal > MAX_POSTGRES_INT) {
            throw new StoreError('VALIDATION', 'Sipariş kalemi tutarı geçerli sınırların dışında.');
          }

          const item = await transaction.orderItem.create({
            data: {
              checkId: input.checkId,
              productId: product.id,
              productNameSnapshot: product.name,
              unitPriceKurusSnapshot: product.priceKurus,
              preparationAreaSnapshot: product.preparationArea,
              quantity: input.quantity,
              note: input.note,
              lineTotalKurus: lineTotal,
              createdByUserId: input.actorUserId,
              options: {
                create: selected.map(({ group, value }) => ({
                  optionGroupId: group.id,
                  optionValueId: value.id,
                  groupNameSnapshot: group.name,
                  valueNameSnapshot: value.name,
                  priceDeltaKurusSnapshot: value.priceDeltaKurus,
                })),
              },
            },
          });
          await updateTotal(transaction, input.checkId);
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'ORDER_ITEM_ADDED',
              entityType: 'OrderItem',
              entityId: item.id,
              metadata: { checkId: input.checkId, productId: product.id, quantity: input.quantity },
            },
          });
          return readCheck(transaction, input.checkId);
        }, transactionOptions());
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Adisyon değişti; işlemi yeniden deneyin.');
        }
        throw error;
      }
    },

    async updateOrderItem(input: UpdateOrderItemInput): Promise<CheckResponse> {
      try {
        return await client.$transaction(async (transaction) => {
          const item = await transaction.orderItem.findUnique({
            where: { id: input.itemId },
            include: { options: true, check: { select: { status: true } } },
          });
          if (item === null) throw new StoreError('NOT_FOUND', 'Sipariş kalemi bulunamadı.');
          if (item.check.status !== 'OPEN') {
            throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
          }
          if (item.cancelledAt !== null) {
            throw new StoreError('CONFLICT', 'İptal edilmiş kalem değiştirilemez.');
          }
          const optionTotal = item.options.reduce(
            (total, option) => total + option.priceDeltaKurusSnapshot,
            0,
          );
          const lineTotal = (item.unitPriceKurusSnapshot + optionTotal) * input.quantity;
          if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || lineTotal > MAX_POSTGRES_INT) {
            throw new StoreError('VALIDATION', 'Sipariş kalemi tutarı geçerli sınırların dışında.');
          }
          await transaction.orderItem.update({
            where: { id: item.id },
            data: { quantity: input.quantity, note: input.note, lineTotalKurus: lineTotal },
          });
          await updateTotal(transaction, item.checkId);
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'ORDER_ITEM_UPDATED',
              entityType: 'OrderItem',
              entityId: item.id,
              metadata: { checkId: item.checkId, quantity: input.quantity },
            },
          });
          return readCheck(transaction, item.checkId);
        }, transactionOptions());
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Adisyon değişti; işlemi yeniden deneyin.');
        }
        throw error;
      }
    },

    async cancelOrderItem(input: CancelOrderItemInput): Promise<CheckResponse> {
      try {
        return await client.$transaction(async (transaction) => {
          const item = await transaction.orderItem.findUnique({
            where: { id: input.itemId },
            include: { check: { select: { status: true } } },
          });
          if (item === null) throw new StoreError('NOT_FOUND', 'Sipariş kalemi bulunamadı.');
          if (item.check.status !== 'OPEN') {
            throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
          }
          if (item.cancelledAt !== null) {
            throw new StoreError('CONFLICT', 'Bu sipariş kalemi zaten iptal edilmiş.');
          }
          const cancelledAt = new Date();
          await transaction.orderItem.update({
            where: { id: item.id },
            data: {
              cancellationReason: input.reason,
              cancelledByUserId: input.actorUserId,
              cancelledAt,
            },
          });
          await updateTotal(transaction, item.checkId);
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: 'ORDER_ITEM_CANCELLED',
              entityType: 'OrderItem',
              entityId: item.id,
              metadata: { checkId: item.checkId, reason: input.reason },
            },
          });
          return readCheck(transaction, item.checkId);
        }, transactionOptions());
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Adisyon değişti; işlemi yeniden deneyin.');
        }
        throw error;
      }
    },

    async listKitchenOrders(preparationArea): Promise<KitchenOrderResponse[]> {
      const items = await client.orderItem.findMany({
        where: {
          check: { status: 'OPEN' },
          cancelledAt: null,
          preparationStatus: { not: 'SERVED' },
          ...(preparationArea === undefined ? {} : { preparationAreaSnapshot: preparationArea }),
        },
        orderBy: { createdAt: 'asc' },
        include: {
          check: { include: { table: true } },
          options: { orderBy: { id: 'asc' } },
        },
      });

      return items.map((item) => ({
        itemId: item.id,
        checkId: item.checkId,
        tableName: item.check.table.name,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        note: item.note,
        preparationArea: item.preparationAreaSnapshot,
        preparationStatus: item.preparationStatus,
        createdAt: item.createdAt.toISOString(),
        options: item.options.map((option) => ({
          groupNameSnapshot: option.groupNameSnapshot,
          valueNameSnapshot: option.valueNameSnapshot,
        })),
      }));
    },

    async updateOrderItemStatus(input: UpdateOrderItemStatusInput): Promise<CheckResponse> {
      try {
        return await client.$transaction(async (transaction) => {
          const item = await transaction.orderItem.findUnique({
            where: { id: input.itemId },
            include: { check: { select: { status: true } } },
          });
          if (item === null) throw new StoreError('NOT_FOUND', 'Sipariş kalemi bulunamadı.');
          if (item.check.status !== 'OPEN') {
            throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
          }
          if (item.cancelledAt !== null) {
            throw new StoreError(
              'CONFLICT',
              'İptal edilmiş kalemin hazırlık durumu değiştirilemez.',
            );
          }
          if (NEXT_STATUS[item.preparationStatus] !== input.status) {
            throw new StoreError('CONFLICT', 'Geçersiz hazırlık durumu geçişi.');
          }

          await transaction.orderItem.update({
            where: { id: item.id },
            data: { preparationStatus: input.status },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: input.actorUserId,
              action: STATUS_AUDIT_ACTION[input.status as Exclude<OrderItemStatus, 'SENT'>],
              entityType: 'OrderItem',
              entityId: item.id,
              metadata: { checkId: item.checkId, preparationStatus: input.status },
            },
          });
          return readCheck(transaction, item.checkId);
        }, transactionOptions());
      } catch (error) {
        if (isSerializationConflict(error)) {
          throw new StoreError('CONFLICT', 'Sipariş durumu değişti; işlemi yeniden deneyin.');
        }
        throw error;
      }
    },
  };
}
