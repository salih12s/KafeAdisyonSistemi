import type {
  ProductRecipeResponse,
  StockItemDetailResponse,
  StockItemResponse,
  StockUnit,
} from '@kafe/contracts';

export interface StockItemCreateInput {
  actorUserId: string;
  name: string;
  nameKey: string;
  unit: StockUnit;
  lowStockThreshold: number;
  isActive: boolean;
}

/** Birim oluşturulduktan sonra değişmez; geçmiş hareketlerin anlamı bozulur. */
export type StockItemUpdateInput = Omit<StockItemCreateInput, 'unit'>;

export type StockMovementInput =
  | {
      actorUserId: string;
      stockItemId: string;
      type: 'PURCHASE' | 'WASTE';
      /** Her zaman pozitif; fire stoktan düşülür. */
      quantity: number;
      reason: string | null;
    }
  | {
      actorUserId: string;
      stockItemId: string;
      type: 'ADJUSTMENT';
      /** Sayımda bulunan miktar; fark hareket olarak yazılır. */
      countedQuantity: number;
      reason: string | null;
    };

export interface RecipeWriteInput {
  actorUserId: string;
  productId: string;
  lines: Array<{ stockItemId: string; quantityPerUnit: number }>;
}

export interface StockStore {
  listStockItems(includeInactive: boolean): Promise<StockItemResponse[]>;
  getStockItem(id: string): Promise<StockItemDetailResponse>;
  createStockItem(input: StockItemCreateInput): Promise<StockItemResponse>;
  updateStockItem(id: string, input: StockItemUpdateInput): Promise<StockItemResponse>;
  addStockMovement(input: StockMovementInput): Promise<StockItemDetailResponse>;
  getProductRecipe(productId: string): Promise<ProductRecipeResponse>;
  setProductRecipe(input: RecipeWriteInput): Promise<ProductRecipeResponse>;
}
