import { randomUUID } from 'node:crypto';
import type {
  CheckResponse,
  KitchenOrderResponse,
  OperationalFloorPlanResponse,
  OrderItemResponse,
  OrderItemStatus,
  PaymentSplitResponse,
  CustomerResponse,
  CustomerStatementResponse,
  AccountEntryResponse,
} from '@kafe/contracts';
import {
  StoreError,
  type AddOrderItemInput,
  type AddPaymentInput,
  type CancelOrderItemInput,
  type CloseCheckInput,
  type OpenCheckInput,
  type OrderStore,
  type AccountStore,
  type CustomerWriteInput,
  type AccountEntryInput,
  type TransferCheckInput,
  type ApplyDiscountInput,
  type ComplimentaryItemInput,
  type MoveCheckInput,
  type MergeChecksInput,
  type SplitPaymentInput,
  type UpdateOrderItemInput,
  type UpdateOrderItemStatusInput,
} from '../../src/features/store';
import { calculatePaymentSplit } from '../../src/features/payment-calculations';
import { MemoryMenuStore } from './memory-menu-store';

interface OrderTable {
  id: string;
  name: string;
  isActive: boolean;
  areaIsActive: boolean;
}

export abstract class MemoryOrderStore extends MemoryMenuStore implements OrderStore, AccountStore {
  protected readonly checks: CheckResponse[] = [];
  private readonly customers: CustomerStatementResponse[] = [];

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
      discountTotalKurus: 0,
      paidKurus: 0,
      remainingKurus: 0,
      closedAt: null,
      closedByUserId: null,
      closedByName: null,
      payments: [],
      discounts: [],
      mergedIntoCheckId: null,
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
    if (this.findOrderTable(tableId) === null) {
      throw new StoreError('NOT_FOUND', 'Masa bulunamadı.');
    }
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
      preparationAreaSnapshot: product.preparationArea,
      preparationStatus: 'SENT',
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
      complimentaryAt: null,
      complimentaryReason: null,
      complimentaryByUserId: null,
      complimentaryByName: null,
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
    const nextLineTotal = (item.unitPriceKurusSnapshot + optionTotal) * input.quantity;
    const nextCheckTotal = check.totalKurus - item.lineTotalKurus + nextLineTotal;
    if (nextCheckTotal < check.paidKurus) {
      throw new StoreError(
        'CONFLICT',
        'İşlem, alınmış ödemelerden düşük bir adisyon toplamı oluşturamaz.',
      );
    }
    item.quantity = input.quantity;
    item.note = input.note;
    item.lineTotalKurus = nextLineTotal;
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_UPDATED', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async cancelOrderItem(input: CancelOrderItemInput): Promise<CheckResponse> {
    const { check, item } = this.requireItem(input.itemId);
    this.ensureMutable(check, item);
    if (check.totalKurus - item.lineTotalKurus < check.paidKurus) {
      throw new StoreError('CONFLICT', 'Ödemesi alınmış sipariş kalemi iptal edilemez.');
    }
    item.cancellationReason = input.reason;
    item.cancelledByUserId = input.actorUserId;
    item.cancelledByName = this.findOrderUserName(input.actorUserId);
    item.cancelledAt = new Date().toISOString();
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_CANCELLED', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async listKitchenOrders(preparationArea?: 'KITCHEN' | 'BAR'): Promise<KitchenOrderResponse[]> {
    return this.checks.flatMap((check) =>
      check.status === 'OPEN'
        ? check.items
            .filter(
              (item) =>
                item.cancelledAt === null &&
                item.preparationStatus !== 'SERVED' &&
                (preparationArea === undefined || item.preparationAreaSnapshot === preparationArea),
            )
            .map((item) => ({
              itemId: item.id,
              checkId: check.id,
              tableName: check.tableName,
              productNameSnapshot: item.productNameSnapshot,
              quantity: item.quantity,
              note: item.note,
              preparationArea: item.preparationAreaSnapshot,
              preparationStatus: item.preparationStatus,
              createdAt: item.createdAt,
              options: item.options.map((option) => ({
                groupNameSnapshot: option.groupNameSnapshot,
                valueNameSnapshot: option.valueNameSnapshot,
              })),
            }))
        : [],
    );
  }

  async updateOrderItemStatus(input: UpdateOrderItemStatusInput): Promise<CheckResponse> {
    const { check, item } = this.requireItem(input.itemId);
    this.ensureMutable(check, item);
    const next: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
      SENT: 'PREPARING',
      PREPARING: 'READY',
      READY: 'SERVED',
    };
    if (next[item.preparationStatus] !== input.status) {
      throw new StoreError('CONFLICT', 'Geçersiz hazırlık durumu geçişi.');
    }
    item.preparationStatus = input.status;
    const auditActions: Partial<Record<OrderItemStatus, string>> = {
      PREPARING: 'ORDER_ITEM_PREPARING',
      READY: 'ORDER_ITEM_READY',
      SERVED: 'ORDER_ITEM_SERVED',
    };
    const action = auditActions[input.status];
    if (action !== undefined) this.record(input.actorUserId, action, 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async addPayment(input: AddPaymentInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    if (input.amountKurus > check.remainingKurus) {
      throw new StoreError('VALIDATION', 'Ödeme kalan bakiyeyi aşamaz.');
    }
    if (input.method === 'CASH' && (input.cashReceivedKurus ?? 0) < input.amountKurus) {
      throw new StoreError('VALIDATION', 'Alınan nakit ödeme tutarından az olamaz.');
    }
    check.payments.push({
      id: randomUUID(),
      method: input.method,
      amountKurus: input.amountKurus,
      receivedByUserId: input.actorUserId,
      receivedByName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    });
    this.recalculate(check);
    this.record(input.actorUserId, 'PAYMENT_RECEIVED', 'Payment', check.payments.at(-1)?.id ?? '');
    return cloneCheck(check);
  }

  async previewPaymentSplit(input: SplitPaymentInput): Promise<PaymentSplitResponse> {
    const check = this.requireOpenCheck(input.checkId);
    const split = calculatePaymentSplit(check, input);
    this.record(input.actorUserId, 'CHECK_SPLIT_PREVIEWED', 'Check', check.id);
    return split;
  }

  async closeCheck(input: CloseCheckInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    if (check.remainingKurus !== 0) {
      throw new StoreError(
        'CONFLICT',
        'Adisyon yalnız kalan bakiye sıfır olduğunda kapatılabilir.',
      );
    }
    check.status = 'PAID';
    check.closedAt = new Date().toISOString();
    check.closedByUserId = input.actorUserId;
    check.closedByName = this.findOrderUserName(input.actorUserId);
    this.record(input.actorUserId, 'CHECK_CLOSED', 'Check', check.id);
    return cloneCheck(check);
  }

  async applyDiscount(input: ApplyDiscountInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    const baseTotal = check.totalKurus + check.discountTotalKurus;
    const amount =
      input.type === 'PERCENT' ? Math.floor((baseTotal * input.value) / 100) : input.value;
    const applied = Math.min(amount, check.totalKurus);
    if (check.totalKurus - applied < check.paidKurus) {
      throw new StoreError(
        'CONFLICT',
        'İndirim, adisyon toplamını alınmış ödemelerin altına indiremez.',
      );
    }
    check.discounts.push({
      id: randomUUID(),
      type: input.type,
      value: input.value,
      amountKurus: applied,
      reason: input.reason,
      appliedByUserId: input.actorUserId,
      appliedByName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    });
    this.recalculate(check);
    this.record(input.actorUserId, 'CHECK_DISCOUNT_APPLIED', 'Check', check.id);
    return cloneCheck(check);
  }

  async makeOrderItemComplimentary(input: ComplimentaryItemInput): Promise<CheckResponse> {
    const { check, item } = this.requireItem(input.itemId);
    this.ensureMutable(check, item);
    if (item.complimentaryAt !== null) throw new StoreError('CONFLICT', 'Bu kalem zaten ikram.');
    if (Math.max(0, check.totalKurus - item.lineTotalKurus) < check.paidKurus) {
      throw new StoreError('CONFLICT', 'İkram, toplamı alınmış ödemelerin altına indiremez.');
    }
    item.complimentaryAt = new Date().toISOString();
    item.complimentaryReason = input.reason;
    item.complimentaryByUserId = input.actorUserId;
    item.complimentaryByName = this.findOrderUserName(input.actorUserId);
    this.recalculate(check);
    this.record(input.actorUserId, 'ORDER_ITEM_COMPLIMENTARY', 'OrderItem', item.id);
    return cloneCheck(check);
  }

  async moveCheck(input: MoveCheckInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    const table = this.findOrderTable(input.targetTableId);
    if (table === null || !table.isActive || !table.areaIsActive) {
      throw new StoreError('CONFLICT', 'Hedef masa aktif değil.');
    }
    if (this.checks.some((entry) => entry.tableId === table.id && entry.status === 'OPEN')) {
      throw new StoreError('CONFLICT', 'Hedef masada açık adisyon var.');
    }
    check.tableId = table.id;
    check.tableName = table.name;
    this.record(input.actorUserId, 'CHECK_TABLE_MOVED', 'Check', check.id);
    return cloneCheck(check);
  }

  async mergeChecks(input: MergeChecksInput): Promise<CheckResponse> {
    if (input.sourceCheckId === input.targetCheckId) {
      throw new StoreError('VALIDATION', 'Adisyon kendisiyle birleştirilemez.');
    }
    const source = this.requireOpenCheck(input.sourceCheckId);
    const target = this.requireOpenCheck(input.targetCheckId);
    target.items.push(...source.items);
    target.payments.push(...source.payments);
    target.discounts.push(...source.discounts);
    source.items = [];
    source.payments = [];
    source.discounts = [];
    source.status = 'MERGED';
    source.mergedIntoCheckId = target.id;
    source.totalKurus = 0;
    source.paidKurus = 0;
    source.remainingKurus = 0;
    source.closedAt = new Date().toISOString();
    source.closedByUserId = input.actorUserId;
    source.closedByName = this.findOrderUserName(input.actorUserId);
    this.recalculate(target);
    this.record(input.actorUserId, 'CHECKS_MERGED', 'Check', target.id);
    return cloneCheck(target);
  }

  async listCustomers(search?: string): Promise<CustomerResponse[]> {
    const key = search?.toLocaleLowerCase('tr-TR');
    return this.customers
      .filter(
        (customer) =>
          key === undefined ||
          customer.name.toLocaleLowerCase('tr-TR').includes(key) ||
          customer.phone?.includes(search ?? '') === true,
      )
      .map(({ entries: _entries, ...customer }) => structuredClone(customer));
  }

  async getCustomer(id: string): Promise<CustomerStatementResponse> {
    const row = this.customers.find((customer) => customer.id === id);
    if (row === undefined) throw new StoreError('NOT_FOUND', 'Müşteri bulunamadı.');
    return structuredClone(row);
  }

  async createCustomer(input: CustomerWriteInput): Promise<CustomerResponse> {
    const now = new Date().toISOString();
    const row: CustomerStatementResponse = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone,
      note: input.note,
      isActive: input.isActive,
      balanceKurus: 0,
      createdAt: now,
      updatedAt: now,
      entries: [],
    };
    this.customers.push(row);
    this.record(input.actorUserId, 'CUSTOMER_CREATED', 'Customer', row.id);
    const { entries: _entries, ...result } = row;
    return structuredClone(result);
  }

  async updateCustomer(id: string, input: CustomerWriteInput): Promise<CustomerResponse> {
    const row = this.customers.find((customer) => customer.id === id);
    if (row === undefined) throw new StoreError('NOT_FOUND', 'Müşteri bulunamadı.');
    Object.assign(row, {
      name: input.name,
      phone: input.phone,
      note: input.note,
      isActive: input.isActive,
      updatedAt: new Date().toISOString(),
    });
    this.record(input.actorUserId, 'CUSTOMER_UPDATED', 'Customer', row.id);
    const { entries: _entries, ...result } = row;
    return structuredClone(result);
  }

  async addAccountEntry(input: AccountEntryInput): Promise<CustomerStatementResponse> {
    const customer = this.customers.find((row) => row.id === input.customerId);
    if (customer === undefined || !customer.isActive) {
      throw new StoreError('CONFLICT', 'Aktif müşteri bulunamadı.');
    }
    const entry: AccountEntryResponse = {
      id: randomUUID(),
      customerId: customer.id,
      type: input.type,
      amountKurus: input.amountKurus,
      description: input.description,
      checkId: null,
      actorUserId: input.actorUserId,
      actorName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    };
    customer.entries.unshift(entry);
    this.recalculateCustomer(customer);
    this.record(
      input.actorUserId,
      input.type === 'COLLECTION' ? 'ACCOUNT_COLLECTION' : 'ACCOUNT_ENTRY_CREATED',
      'AccountEntry',
      entry.id,
    );
    return structuredClone(customer);
  }

  async transferCheckToAccount(input: TransferCheckInput): Promise<CheckResponse> {
    const check = this.requireOpenCheck(input.checkId);
    const customer = this.customers.find((row) => row.id === input.customerId);
    if (customer === undefined || !customer.isActive) {
      throw new StoreError('CONFLICT', 'Aktif müşteri bulunamadı.');
    }
    if (check.remainingKurus <= 0) {
      throw new StoreError('CONFLICT', 'Cariye aktarılacak bakiye bulunmuyor.');
    }
    const amountKurus = check.remainingKurus;
    customer.entries.unshift({
      id: randomUUID(),
      customerId: customer.id,
      type: 'DEBT',
      amountKurus,
      description: 'Adisyon borcu',
      checkId: check.id,
      actorUserId: input.actorUserId,
      actorName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    });
    check.payments.push({
      id: randomUUID(),
      method: 'ACCOUNT',
      amountKurus,
      receivedByUserId: input.actorUserId,
      receivedByName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    });
    this.recalculateCustomer(customer);
    this.recalculate(check);
    this.record(input.actorUserId, 'CHECK_TRANSFERRED_TO_ACCOUNT', 'Check', check.id);
    return cloneCheck(check);
  }

  protected requireCheck(id: string): CheckResponse {
    const check = this.checks.find((entry) => entry.id === id);
    if (check === undefined) throw new StoreError('NOT_FOUND', 'Adisyon bulunamadı.');
    return check;
  }

  protected requireOpenCheck(id: string): CheckResponse {
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
    if (item.complimentaryAt !== null) {
      throw new StoreError('CONFLICT', 'İkram edilmiş kalem değiştirilemez.');
    }
  }

  private recalculate(check: CheckResponse): void {
    check.totalKurus = check.items
      .filter((item) => item.cancelledAt === null && item.complimentaryAt === null)
      .reduce((total, item) => total + item.lineTotalKurus, 0);
    check.discountTotalKurus = check.discounts.reduce(
      (total, discount) => total + discount.amountKurus,
      0,
    );
    check.totalKurus = Math.max(0, check.totalKurus - check.discountTotalKurus);
    check.paidKurus = check.payments.reduce((total, payment) => total + payment.amountKurus, 0);
    check.remainingKurus = check.totalKurus - check.paidKurus;
  }

  private recalculateCustomer(customer: CustomerStatementResponse): void {
    customer.balanceKurus = customer.entries.reduce(
      (total, entry) =>
        total +
        (entry.type === 'DEBT' || entry.type === 'REFUND' ? entry.amountKurus : -entry.amountKurus),
      0,
    );
  }
}

function cloneCheck(check: CheckResponse): CheckResponse {
  return structuredClone(check);
}
