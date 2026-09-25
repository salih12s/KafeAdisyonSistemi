import { randomUUID } from 'node:crypto';
import type {
  CashMovementResponse,
  CashSessionResponse,
  CheckResponse,
  ProductRecipeResponse,
  StockItemDetailResponse,
  StockItemResponse,
  StockMovementResponse,
  StockMovementType,
} from '@kafe/contracts';
import {
  StoreError,
  type CashMovementInput,
  type CashStore,
  type CloseCashSessionInput,
  type CloseCheckInput,
  type OpenCashSessionInput,
  type RecipeWriteInput,
  type StockItemCreateInput,
  type StockItemUpdateInput,
  type StockMovementInput,
  type StockStore,
} from '../../src/shared/store';
import { buildCashSession, type CashSessionSource } from '../../src/modules/cash/cash-calculations';
import {
  manualMovementDelta,
  saleConsumption,
  toStockItem,
  type StockItemSource,
} from '../../src/modules/stock/stock-calculations';
import { MemoryOrderStore } from './memory-order-store';

interface MemoryCashSession extends Omit<CashSessionSource, 'movements'> {
  movements: CashMovementResponse[];
}

interface MemoryStockItem extends StockItemSource {
  nameKey: string;
}

interface MemoryStockMovement extends StockMovementResponse {
  stockItemId: string;
}

interface MemoryUsage {
  productId: string;
  stockItemId: string;
  quantityPerUnit: number;
  isActive: boolean;
}

/**
 * Phase 8 kasa ve stok işlemlerinin bellek içi karşılığı. Hesaplar Prisma
 * store'u ile aynı saf fonksiyonlardan geçer.
 */
export abstract class MemoryOperationsStore
  extends MemoryOrderStore
  implements CashStore, StockStore
{
  protected readonly cashSessions: MemoryCashSession[] = [];
  protected readonly stockItems: MemoryStockItem[] = [];
  protected readonly stockMovements: MemoryStockMovement[] = [];
  protected readonly stockUsages: MemoryUsage[] = [];

  async getCurrentCashSession(): Promise<CashSessionResponse | null> {
    const session = this.cashSessions.find((entry) => entry.status === 'OPEN');
    return session === undefined ? null : this.toCashSession(session);
  }

  async listClosedCashSessions(limit: number): Promise<CashSessionResponse[]> {
    return this.cashSessions
      .filter((entry) => entry.status === 'CLOSED')
      .reverse()
      .slice(0, limit)
      .map((entry) => this.toCashSession(entry));
  }

  async openCashSession(input: OpenCashSessionInput): Promise<CashSessionResponse> {
    if (this.cashSessions.some((entry) => entry.status === 'OPEN')) {
      throw new StoreError('CONFLICT', 'Zaten açık bir kasa oturumu var.');
    }
    const session: MemoryCashSession = {
      id: randomUUID(),
      status: 'OPEN',
      openedAt: new Date(),
      openedByName: this.findOrderUserName(input.actorUserId),
      openingCashKurus: input.openingCashKurus,
      openingNote: input.note,
      closedAt: null,
      closedByName: null,
      countedCashKurus: null,
      expectedCashKurus: null,
      closingNote: null,
      movements: [],
    };
    this.cashSessions.push(session);
    this.record(input.actorUserId, 'CASH_SESSION_OPENED', 'CashSession', session.id);
    return this.toCashSession(session);
  }

  async addCashMovement(input: CashMovementInput): Promise<CashSessionResponse> {
    const session = this.requireOpenCashSession();
    session.movements.unshift({
      id: randomUUID(),
      type: input.type,
      amountKurus: input.amountKurus,
      reason: input.reason,
      actorName: this.findOrderUserName(input.actorUserId),
      createdAt: new Date().toISOString(),
    });
    this.record(input.actorUserId, 'CASH_MOVEMENT_ADDED', 'CashSession', session.id);
    return this.toCashSession(session);
  }

  async closeCashSession(input: CloseCashSessionInput): Promise<CashSessionResponse> {
    const session = this.requireOpenCashSession();
    const closedAt = new Date();
    const expected = buildCashSession(
      { ...session, closedAt },
      this.cashSales(session.openedAt, closedAt),
    ).expectedCashKurus;
    session.status = 'CLOSED';
    session.closedAt = closedAt;
    session.closedByName = this.findOrderUserName(input.actorUserId);
    session.countedCashKurus = input.countedCashKurus;
    session.expectedCashKurus = expected;
    session.closingNote = input.note;
    this.record(input.actorUserId, 'CASH_SESSION_CLOSED', 'CashSession', session.id);
    return this.toCashSession(session);
  }

  async listStockItems(includeInactive: boolean): Promise<StockItemResponse[]> {
    return this.stockItems
      .filter((item) => includeInactive || item.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, 'tr'))
      .map((item) => toStockItem(item, this.balance(item.id)));
  }

  async getStockItem(id: string): Promise<StockItemDetailResponse> {
    const item = this.requireStockItem(id);
    return {
      ...toStockItem(item, this.balance(id)),
      movements: this.stockMovements
        .filter((movement) => movement.stockItemId === id)
        .reverse()
        .map((movement) => ({
          id: movement.id,
          type: movement.type,
          quantityDelta: movement.quantityDelta,
          reason: movement.reason,
          checkId: movement.checkId,
          actorName: movement.actorName,
          createdAt: movement.createdAt,
        })),
    };
  }

  async createStockItem(input: StockItemCreateInput): Promise<StockItemResponse> {
    this.ensureUniqueStockName(input.nameKey);
    const now = new Date();
    const item: MemoryStockItem = {
      id: randomUUID(),
      name: input.name,
      nameKey: input.nameKey,
      unit: input.unit,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive,
      createdAt: now,
      updatedAt: now,
    };
    this.stockItems.push(item);
    this.record(input.actorUserId, 'STOCK_ITEM_CREATED', 'StockItem', item.id);
    return toStockItem(item, 0);
  }

  async updateStockItem(id: string, input: StockItemUpdateInput): Promise<StockItemResponse> {
    const item = this.requireStockItem(id);
    this.ensureUniqueStockName(input.nameKey, id);
    Object.assign(item, {
      name: input.name,
      nameKey: input.nameKey,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive,
      updatedAt: new Date(),
    });
    this.record(input.actorUserId, 'STOCK_ITEM_UPDATED', 'StockItem', id);
    return toStockItem(item, this.balance(id));
  }

  async addStockMovement(input: StockMovementInput): Promise<StockItemDetailResponse> {
    const item = this.requireStockItem(input.stockItemId);
    const quantityDelta = manualMovementDelta(input, this.balance(item.id));
    this.pushMovement(item.id, input.type, quantityDelta, input.reason, null, input.actorUserId);
    this.record(input.actorUserId, 'STOCK_MOVEMENT_ADDED', 'StockItem', item.id);
    return this.getStockItem(item.id);
  }

  async getProductRecipe(productId: string): Promise<ProductRecipeResponse> {
    if (!this.products.some((product) => product.id === productId)) {
      throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
    }
    return {
      productId,
      lines: this.stockUsages
        .filter((usage) => usage.productId === productId && usage.isActive)
        .map((usage) => {
          const item = this.requireStockItem(usage.stockItemId);
          return {
            stockItemId: item.id,
            stockItemName: item.name,
            unit: item.unit,
            quantityPerUnit: usage.quantityPerUnit,
          };
        })
        .sort((left, right) => left.stockItemName.localeCompare(right.stockItemName, 'tr')),
    };
  }

  async setProductRecipe(input: RecipeWriteInput): Promise<ProductRecipeResponse> {
    const ids = input.lines.map((line) => line.stockItemId);
    if (new Set(ids).size !== ids.length) {
      throw new StoreError('VALIDATION', 'Aynı stok kalemi reçetede bir kez yer alabilir.');
    }
    if (!this.products.some((product) => product.id === input.productId)) {
      throw new StoreError('NOT_FOUND', 'Ürün bulunamadı.');
    }
    if (!ids.every((id) => this.stockItems.some((item) => item.id === id))) {
      throw new StoreError('VALIDATION', 'Reçetedeki stok kalemlerinden biri bulunamadı.');
    }
    for (const usage of this.stockUsages) {
      if (usage.productId === input.productId && !ids.includes(usage.stockItemId)) {
        usage.isActive = false;
      }
    }
    for (const line of input.lines) {
      const existing = this.stockUsages.find(
        (usage) => usage.productId === input.productId && usage.stockItemId === line.stockItemId,
      );
      if (existing === undefined) {
        this.stockUsages.push({ productId: input.productId, ...line, isActive: true });
      } else {
        existing.quantityPerUnit = line.quantityPerUnit;
        existing.isActive = true;
      }
    }
    this.record(input.actorUserId, 'PRODUCT_RECIPE_UPDATED', 'Product', input.productId);
    return this.getProductRecipe(input.productId);
  }

  override async closeCheck(input: CloseCheckInput): Promise<CheckResponse> {
    const closed = await super.closeCheck(input);
    const consumption = saleConsumption(
      closed.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        cancelled: item.cancelledAt !== null,
      })),
      this.stockUsages.filter((usage) => usage.isActive),
    );
    for (const [stockItemId, quantity] of consumption) {
      this.pushMovement(stockItemId, 'SALE', -quantity, null, closed.id, input.actorUserId);
    }
    return closed;
  }

  private cashSales(from: Date, to: Date): number {
    return this.checks
      .flatMap((check) => check.payments)
      .filter((payment) => {
        const at = new Date(payment.createdAt);
        return payment.method === 'CASH' && at >= from && at < to;
      })
      .reduce((total, payment) => total + payment.amountKurus, 0);
  }

  private toCashSession(session: MemoryCashSession): CashSessionResponse {
    const live = session.status === 'OPEN' ? this.cashSales(session.openedAt, new Date()) : 0;
    return buildCashSession(session, live);
  }

  private requireOpenCashSession(): MemoryCashSession {
    const session = this.cashSessions.find((entry) => entry.status === 'OPEN');
    if (session === undefined) throw new StoreError('CONFLICT', 'Açık bir kasa oturumu yok.');
    return session;
  }

  private balance(stockItemId: string): number {
    return this.stockMovements
      .filter((movement) => movement.stockItemId === stockItemId)
      .reduce((total, movement) => total + movement.quantityDelta, 0);
  }

  private requireStockItem(id: string): MemoryStockItem {
    const item = this.stockItems.find((entry) => entry.id === id);
    if (item === undefined) throw new StoreError('NOT_FOUND', 'Stok kalemi bulunamadı.');
    return item;
  }

  private ensureUniqueStockName(nameKey: string, exceptId?: string): void {
    if (this.stockItems.some((item) => item.nameKey === nameKey && item.id !== exceptId)) {
      throw new StoreError('CONFLICT', 'Bu stok kalemi adı zaten kullanılıyor.');
    }
  }

  private pushMovement(
    stockItemId: string,
    type: StockMovementType,
    quantityDelta: number,
    reason: string | null,
    checkId: string | null,
    actorUserId: string,
  ): void {
    this.stockMovements.push({
      id: randomUUID(),
      stockItemId,
      type,
      quantityDelta,
      reason,
      checkId,
      actorName: this.findOrderUserName(actorUserId),
      createdAt: new Date().toISOString(),
    });
  }
}
