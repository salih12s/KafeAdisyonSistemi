import { randomUUID } from 'node:crypto';
import type {
  CheckResponse,
  OperationalFloorPlanResponse,
  OrderItemResponse,
} from '@kafe/contracts';
import {
  StoreError,
  type AddOrderItemInput,
  type CancelOrderItemInput,
  type OpenCheckInput,
  type OrderStore,
  type UpdateOrderItemInput,
} from '../../src/features/store';
import { MemoryMenuStore } from './memory-menu-store';

interface OrderTable {
  id: string;
  name: string;
  isActive: boolean;
  areaIsActive: boolean;
}

export abstract class MemoryOrderStore extends MemoryMenuStore implements OrderStore {
  private readonly checks: CheckResponse[] = [];

  protected abstract findOrderTable(id: string): OrderTable | null;
  protected abstract findOrderUserName(id: string): string;
  protected abstract orderFloorPlan(): Omit<OperationalFloorPlanResponse, 'areas'> & {
    areas: Array<{
      id: string;
      name: string;
      sortOrder: number;
      tables: Array<{
        id: string;
        name: string;
        capacity: number | null;
        sortOrder: number;
      }>;
    }>;
  };

  async getOperationalFloorPlan(): Promise<OperationalFloorPlanResponse> {
    const floor = this.orderFloorPlan();
    return {
      areas: floor.areas.map((area) => ({
        ...area,
        tables: area.tables.map((table) => {
          const check = this.checks.find(
            (entry) => entry.tableId === table.id && entry.status === 'OPEN',
          );
          return {
            ...table,
            openCheck:
              check === undefined
                ? null
                : {
                    id: check.id,
                    guestCount: check.guestCount,
                    openedAt: check.openedAt,
                    totalKurus: check.totalKurus,
                  },
          };
        }),
      })),
    };
  }

  async openCheck(input: OpenCheckInput): Promise<CheckResponse> {
    const table = this.findOrderTable(input.tableId);
    if (table === null) throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
    if (!table.isActive || !table.areaIsActive) {
      throw new StoreError('CONFLICT', 'Pasif bir masa adisyona açılamaz.');
    }
    if (this.checks.some((check) => check.tableId === table.id && check.status === 'OPEN')) {
      throw new StoreError('CONFLICT', 'Bu masada zaten açık bir adisyon var.');
    }
    const check: CheckResponse = {
      id: randomUUID(),
      tableId: table.id,
      tableName: table.name,
      openedByUserId: input.actorUserId,
      openedByName: this.findOrderUserName(input.actorUserId),
      guestCount: input.guestCount,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      totalKurus: 0,
      items: [],
    };
    this.checks.push(check);
    this.record(input.actorUserId, 'CHECK_OPENED', 'Check', check.id);
    return cloneCheck(check);
  }

  async getCheck(id: string): Promise<CheckResponse> {
    return cloneCheck(this.requireCheck(id));
  }

  async getOpenCheckByTable(tableId: string): Promise<CheckResponse | null> {
    if (this.findOrderTable(tableId) === null)
      {throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');}
    const check = this.checks.find((entry) => entry.tableId === tableId && entry.status === 'OPEN');
    return check === undefined ? null : cloneCheck(check);
  }

  async addOrderItem(input: AddOrderItemInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    const menu = await this.getMenu();
    const product = menu.categories
      .flatMap((category) => category.products)
      .find((entry) => entry.id === input.productId);
    if (product === undefined) throw new StoreError('VALIDATION', 'Bu ürün satışa açık değil.');
    if (new Set(input.optionValueIds).size !== input.optionValueIds.length) {
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
        throw new StoreError('VALIDATION', `${group.name} grubundan yalnız bir seçim yapılabilir.`);
      }
    }
    const optionTotal = selected.reduce((total, entry) => total + entry.value.priceDeltaKurus, 0);
    const lineTotal = (product.priceKurus + optionTotal) * input.quantity;
    if (!Number.isSafeInteger(lineTotal) || lineTotal < 0 || lineTotal > 2_147_483_647) {
      throw new StoreError('VALIDATION', 'Sipariş kalemi tutarı geçerli sınırların dışında.');
    }
    const item: OrderItemResponse = {
      id: randomUUID(),
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceKurusSnapshot: product.priceKurus,
      quantity: input.quantity,
      note: input.note,
      lineTotalKurus: lineTotal,
      createdByUserId: input.actorUserId,
      createdByName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      cancellationReason: null,
      cancelledByUserId: null,
      cancelledByName: null,
      options: selected.map(({ group, value }) => ({
        id: randomUUID(),
        optionGroupId: group.id,
        optionValueId: value.id,
        groupNameSnapshot: group.name,
        valueNameSnapshot: value.name,
        priceDeltaKurusSnapshot: value.priceDeltaKurus,
      })),
    };
    check.items.push(item);
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_ADDED', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async updateOrderItem(input: UpdateOrderItemInput): Promise<CheckResponse> {
    const { check, item } = this.requireItem(input.itemId);
    this.ensureMutable(check, item);
    const optionTotal = item.options.reduce(
      (total, option) => total + option.priceDeltaKurusSnapshot,
      0,
    );
    item.quantity = input.quantity;
    item.note = input.note;
    item.lineTotalKurus = (item.unitPriceKurusSnapshot + optionTotal) * input.quantity;
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_UPDATED', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async cancelOrderItem(input: CancelOrderItemInput): Promise<CheckResponse> {
    const { check, item } = this.requireItem(input.itemId);
    this.ensureMutable(check, item);
    item.cancellationReason = input.reason;
    item.cancelledByUserId = input.actorUserId;
    item.cancelledByName = this.findOrderUserName(input.actorUserId);
    item.cancelledAt = new Date().toISOString();
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_CANCELLED', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  private requireCheck(id: string): CheckResponse {
    const check = this.checks.find((entry) => entry.id === id);
    if (check === undefined) throw new StoreError('NOT_FOUND', 'Adisyon bulunamadı.');
    return check;
  }

  private requireOpenCheck(id: string): CheckResponse {
    const check = this.requireCheck(id);
    if (check.status !== 'OPEN') throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
    return check;
  }

  private requireItem(id: string): { check: CheckResponse; item: OrderItemResponse } {
    for (const check of this.checks) {
      const item = check.items.find((entry) => entry.id === id);
      if (item !== undefined) return { check, item };
    }
    throw new StoreError('NOT_FOUND', 'Sipariş kalemi bulunamadı.');
  }

  private ensureMutable(check: CheckResponse, item: OrderItemResponse): void {
    if (check.status !== 'OPEN') throw new StoreError('CONFLICT', 'Bu adisyon artık açık değil.');
    if (item.cancelledAt !== null) {
      throw new StoreError('CONFLICT', 'İptal edilmiş kalem değiştirilemez.');
    }
  }

  private recalculate(check: CheckResponse): void {
    check.totalKurus = check.items
      .filter((item) => item.cancelledAt === null)
      .reduce((total, item) => total + item.lineTotalKurus, 0);
  }
}

function cloneCheck(check: CheckResponse): CheckResponse {
  return structuredClone(check);
}
