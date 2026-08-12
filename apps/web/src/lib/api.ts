import { CREDENTIALS_MODE, apiUrl } from '../config/api-base';
import {
  HEALTH_ENDPOINT,
  USER_ROLES,
  isHealthResponse,
  isOptionSelectionType,
  isPreparationArea,
  type CafeTableResponse,
  type CategoryResponse,
  type CurrentUser,
  type DiningAreaResponse,
  type FloorPlanResponse,
  type HealthResponse,
  type OptionGroupResponse,
  type OptionSelectionType,
  type OptionValueResponse,
  type PreparationArea,
  type ProductResponse,
  type StaffMember,
  type UserRole,
  type CheckResponse,
  type MenuResponse,
  type OperationalFloorPlanResponse,
  type KitchenOrderResponse,
  type OrderItemStatus,
  type CustomerResponse,
  type CustomerStatementResponse,
  type AccountEntryType,
  type DiscountType,
  type PaymentMethod,
  type PaymentSplitResponse,
  type SalesReportResponse,
  type DayEndResponse,
  type AuditLogListResponse,
} from '@kafe/contracts';

export class ApiError extends Error {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.some((role) => role === value);
}

function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.username === 'string' &&
    isUserRole(value.role)
  );
}

function isStaffMember(value: unknown): value is StaffMember {
  return (
    isCurrentUser(value) &&
    isRecord(value) &&
    typeof value.isActive === 'boolean' &&
    (value.lastLoginAt === null || typeof value.lastLoginAt === 'string') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isArea(value: unknown): value is DiningAreaResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean'
  );
}

function isTable(value: unknown): value is CafeTableResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.areaId === 'string' &&
    typeof value.name === 'string' &&
    (value.capacity === null || typeof value.capacity === 'number') &&
    typeof value.sortOrder === 'number' &&
    typeof value.isActive === 'boolean'
  );
}

function isFloorPlan(value: unknown): value is FloorPlanResponse {
  if (!isRecord(value) || !Array.isArray(value.areas)) return false;
  return value.areas.every(
    (area) =>
      isRecord(area) &&
      typeof area.id === 'string' &&
      typeof area.name === 'string' &&
      typeof area.sortOrder === 'number' &&
      Array.isArray(area.tables) &&
      area.tables.every(
        (table) =>
          isRecord(table) &&
          typeof table.id === 'string' &&
          typeof table.name === 'string' &&
          (table.capacity === null || typeof table.capacity === 'number') &&
          typeof table.sortOrder === 'number',
      ),
  );
}

function readErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.message === 'string' ? payload.error.message : undefined;
}

async function requestPayload(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      credentials: CREDENTIALS_MODE,
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamıyor.');
  }

  const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/me') {
      window.dispatchEvent(new Event('kafe:unauthorized'));
    }
    throw new ApiError(readErrorMessage(payload) ?? 'İstek tamamlanamadı.', response.status);
  }
  return payload;
}

function expectRecord(payload: unknown, key: string): unknown {
  if (!isRecord(payload) || !(key in payload)) {
    throw new ApiError('Sunucudan beklenmeyen bir yanıt alındı.');
  }
  return payload[key];
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(apiUrl(HEALTH_ENDPOINT), {
      credentials: CREDENTIALS_MODE,
      headers: { Accept: 'application/json' },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamıyor.');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (isHealthResponse(payload)) return payload;
  throw new ApiError('Sunucudan beklenmeyen bir yanıt alındı.', response.status);
}

export async function fetchSetupStatus(): Promise<boolean> {
  const payload = await requestPayload('/api/setup/status');
  if (!isRecord(payload) || typeof payload.initialized !== 'boolean') {
    throw new ApiError('Kurulum durumu okunamadı.');
  }
  return payload.initialized;
}

export async function login(username: string, password: string): Promise<CurrentUser> {
  const payload = await requestPayload('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const user = expectRecord(payload, 'user');
  if (!isCurrentUser(user)) throw new ApiError('Kullanıcı bilgisi okunamadı.');
  return user;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const payload = await requestPayload('/api/auth/me');
  const user = expectRecord(payload, 'user');
  if (!isCurrentUser(user)) throw new ApiError('Kullanıcı bilgisi okunamadı.');
  return user;
}

export function logout(): Promise<unknown> {
  return requestPayload('/api/auth/logout', { method: 'POST' });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
  return requestPayload('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchStaff(): Promise<StaffMember[]> {
  const staff = expectRecord(await requestPayload('/api/staff'), 'staff');
  if (!Array.isArray(staff) || !staff.every(isStaffMember)) {
    throw new ApiError('Personel listesi okunamadı.');
  }
  return staff;
}

export function createStaff(input: {
  fullName: string;
  username: string;
  password: string;
  role: UserRole;
}): Promise<unknown> {
  return requestPayload('/api/staff', { method: 'POST', body: JSON.stringify(input) });
}

export function updateStaff(
  id: string,
  input: { fullName: string; role: UserRole; isActive: boolean },
): Promise<unknown> {
  return requestPayload(`/api/staff/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function resetStaffPassword(id: string, password: string): Promise<unknown> {
  return requestPayload(`/api/staff/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function fetchAreas(): Promise<DiningAreaResponse[]> {
  const areas = expectRecord(await requestPayload('/api/areas?includeInactive=true'), 'areas');
  if (!Array.isArray(areas) || !areas.every(isArea)) throw new ApiError('Salon listesi okunamadı.');
  return areas;
}

export function createArea(input: { name: string; sortOrder: number }): Promise<unknown> {
  return requestPayload('/api/areas', { method: 'POST', body: JSON.stringify(input) });
}

export function updateArea(
  id: string,
  input: { name: string; sortOrder: number; isActive: boolean },
): Promise<unknown> {
  return requestPayload(`/api/areas/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function fetchTables(): Promise<CafeTableResponse[]> {
  const tables = expectRecord(await requestPayload('/api/tables?includeInactive=true'), 'tables');
  if (!Array.isArray(tables) || !tables.every(isTable)) {
    throw new ApiError('Masa listesi okunamadı.');
  }
  return tables;
}

export function createTable(input: {
  areaId: string;
  name: string;
  capacity: number | null;
  sortOrder: number;
}): Promise<unknown> {
  return requestPayload('/api/tables', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTable(
  id: string,
  input: {
    areaId: string;
    name: string;
    capacity: number | null;
    sortOrder: number;
    isActive: boolean;
  },
): Promise<unknown> {
  return requestPayload(`/api/tables/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function fetchFloorPlan(): Promise<FloorPlanResponse> {
  const payload = await requestPayload('/api/floor-plan');
  if (!isFloorPlan(payload)) throw new ApiError('Masa düzeni okunamadı.');
  return payload;
}

// --- Phase 2: menü, ürün ve seçenekler ---

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

function isOrderItemOption(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.optionGroupId === 'string' &&
    typeof value.optionValueId === 'string' &&
    typeof value.groupNameSnapshot === 'string' &&
    typeof value.valueNameSnapshot === 'string' &&
    typeof value.priceDeltaKurusSnapshot === 'number'
  );
}

function isOrderItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.productNameSnapshot === 'string' &&
    typeof value.categoryIdSnapshot === 'string' &&
    typeof value.categoryNameSnapshot === 'string' &&
    typeof value.unitPriceKurusSnapshot === 'number' &&
    isPreparationArea(value.preparationAreaSnapshot) &&
    (value.preparationStatus === 'SENT' ||
      value.preparationStatus === 'PREPARING' ||
      value.preparationStatus === 'READY' ||
      value.preparationStatus === 'SERVED') &&
    typeof value.quantity === 'number' &&
    (value.note === null || typeof value.note === 'string') &&
    typeof value.lineTotalKurus === 'number' &&
    typeof value.createdByUserId === 'string' &&
    typeof value.createdByName === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.cancelledAt === null || typeof value.cancelledAt === 'string') &&
    (value.cancellationReason === null || typeof value.cancellationReason === 'string') &&
    (value.cancelledByUserId === null || typeof value.cancelledByUserId === 'string') &&
    (value.cancelledByName === null || typeof value.cancelledByName === 'string') &&
    (value.complimentaryAt === null || typeof value.complimentaryAt === 'string') &&
    (value.complimentaryReason === null || typeof value.complimentaryReason === 'string') &&
    (value.complimentaryByUserId === null || typeof value.complimentaryByUserId === 'string') &&
    (value.complimentaryByName === null || typeof value.complimentaryByName === 'string') &&
    Array.isArray(value.options) &&
    value.options.every(isOrderItemOption)
  );
}

function isCheck(value: unknown): value is CheckResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.tableId === 'string' &&
    typeof value.tableName === 'string' &&
    typeof value.openedByUserId === 'string' &&
    typeof value.openedByName === 'string' &&
    typeof value.guestCount === 'number' &&
    (value.status === 'OPEN' ||
      value.status === 'CANCELLED' ||
      value.status === 'PAID' ||
      value.status === 'MERGED') &&
    typeof value.openedAt === 'string' &&
    typeof value.totalKurus === 'number' &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.paidKurus === 'number' &&
    typeof value.remainingKurus === 'number' &&
    (value.closedAt === null || typeof value.closedAt === 'string') &&
    (value.closedByUserId === null || typeof value.closedByUserId === 'string') &&
    (value.closedByName === null || typeof value.closedByName === 'string') &&
    Array.isArray(value.payments) &&
    value.payments.every(
      (payment) =>
        isRecord(payment) &&
        typeof payment.id === 'string' &&
        (payment.method === 'CASH' || payment.method === 'CARD' || payment.method === 'ACCOUNT') &&
        typeof payment.amountKurus === 'number' &&
        typeof payment.receivedByUserId === 'string' &&
        typeof payment.receivedByName === 'string' &&
        typeof payment.createdAt === 'string',
    ) &&
    Array.isArray(value.discounts) &&
    (value.mergedIntoCheckId === null || typeof value.mergedIntoCheckId === 'string') &&
    Array.isArray(value.items) &&
    value.items.every(isOrderItem)
  );
}

function isCustomer(value: unknown): value is CustomerResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.phone === null || typeof value.phone === 'string') &&
    (value.note === null || typeof value.note === 'string') &&
    typeof value.isActive === 'boolean' &&
    typeof value.balanceKurus === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isAccountEntry(value: unknown): value is CustomerStatementResponse['entries'][number] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.customerId === 'string' &&
    (value.type === 'DEBT' ||
      value.type === 'COLLECTION' ||
      value.type === 'REFUND' ||
      value.type === 'CORRECTION') &&
    typeof value.amountKurus === 'number' &&
    typeof value.description === 'string' &&
    (value.checkId === null || typeof value.checkId === 'string') &&
    typeof value.actorUserId === 'string' &&
    typeof value.actorName === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isCustomerStatement(value: unknown): value is CustomerStatementResponse {
  if (!isRecord(value) || !Array.isArray(value.entries)) return false;
  return isCustomer(value) && value.entries.every(isAccountEntry);
}

export async function fetchCustomers(search = ''): Promise<CustomerResponse[]> {
  const rows = expectRecord(
    await requestPayload(`/api/accounts?search=${encodeURIComponent(search)}`),
    'customers',
  );
  if (!Array.isArray(rows) || !rows.every(isCustomer)) {
    throw new ApiError('Cari listesi okunamadı.');
  }
  return rows;
}
export async function fetchCustomer(id: string): Promise<CustomerStatementResponse> {
  const row = expectRecord(await requestPayload(`/api/accounts/${id}`), 'customer');
  if (!isCustomerStatement(row)) {
    throw new ApiError('Cari ekstre okunamadı.');
  }
  return row;
}
export function createCustomer(input: {
  name: string;
  phone: string | null;
  note: string | null;
  isActive: boolean;
}): Promise<unknown> {
  return requestPayload('/api/accounts', { method: 'POST', body: JSON.stringify(input) });
}
export function updateCustomer(
  id: string,
  input: { name: string; phone: string | null; note: string | null; isActive: boolean },
): Promise<unknown> {
  return requestPayload(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export function addAccountEntry(
  id: string,
  input: { type: Exclude<AccountEntryType, 'DEBT'>; amountKurus: number; description: string },
): Promise<unknown> {
  return requestPayload(`/api/accounts/${id}/entries`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function transferCheckToAccount(
  checkId: string,
  customerId: string,
): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/account-transfer`, {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  }).then(readCheck);
}
export function applyCheckDiscount(
  checkId: string,
  input: { type: DiscountType; value: number; reason: string },
): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/discounts`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(readCheck);
}
export function makeItemComplimentary(itemId: string, reason: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/items/${itemId}/complimentary`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }).then(readCheck);
}
export function moveCheck(checkId: string, targetTableId: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${checkId}/move`, {
    method: 'POST',
    body: JSON.stringify({ targetTableId }),
  }).then(readCheck);
}
export function mergeChecks(targetCheckId: string, sourceCheckId: string): Promise<CheckResponse> {
  return requestPayload(`/api/orders/checks/${targetCheckId}/merge`, {
    method: 'POST',
    body: JSON.stringify({ sourceCheckId }),
  }).then(readCheck);
}

function isOperationalFloorPlan(value: unknown): value is OperationalFloorPlanResponse {
  if (!isRecord(value) || !Array.isArray(value.areas)) return false;
  return value.areas.every(
    (area) =>
      isRecord(area) &&
      typeof area.id === 'string' &&
      typeof area.name === 'string' &&
      typeof area.sortOrder === 'number' &&
      Array.isArray(area.tables) &&
      area.tables.every(
        (table) =>
          isRecord(table) &&
          typeof table.id === 'string' &&
          typeof table.name === 'string' &&
          (table.capacity === null || typeof table.capacity === 'number') &&
          typeof table.sortOrder === 'number' &&
          (table.openCheck === null ||
            (isRecord(table.openCheck) &&
              typeof table.openCheck.id === 'string' &&
              typeof table.openCheck.guestCount === 'number' &&
              typeof table.openCheck.openedAt === 'string' &&
              typeof table.openCheck.totalKurus === 'number')),
      ),
  );
}

function isMenu(value: unknown): value is MenuResponse {
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

export async function fetchOperationalFloorPlan(): Promise<OperationalFloorPlanResponse> {
  const payload = await requestPayload('/api/orders/floor-plan');
  if (!isOperationalFloorPlan(payload)) throw new ApiError('Masa durumları okunamadı.');
  return payload;
}

export async function fetchSalesMenu(): Promise<MenuResponse> {
  const payload = await requestPayload('/api/menu');
  if (!isMenu(payload)) throw new ApiError('Satış menüsü okunamadı.');
  return payload;
}

function readCheck(payload: unknown): CheckResponse {
  const check = expectRecord(payload, 'check');
  if (!isCheck(check)) throw new ApiError('Adisyon bilgisi okunamadı.');
  return check;
}

export async function fetchCheck(id: string): Promise<CheckResponse> {
  return readCheck(await requestPayload(`/api/orders/checks/${id}`));
}

export async function openTableCheck(tableId: string, guestCount: number): Promise<CheckResponse> {
  return readCheck(
    await requestPayload('/api/orders/checks', {
      method: 'POST',
      body: JSON.stringify({ tableId, guestCount }),
    }),
  );
}

export async function addOrderItem(
  checkId: string,
  input: { productId: string; quantity: number; note: string | null; optionValueIds: string[] },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/checks/${checkId}/items`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateOrderItem(
  itemId: string,
  input: { quantity: number; note: string | null },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function cancelOrderItem(itemId: string, reason: string): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function addPayment(
  checkId: string,
  input: {
    method: PaymentMethod;
    amountKurus: number;
    cashReceivedKurus: number | null;
  },
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/checks/${checkId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function previewPaymentSplit(
  checkId: string,
  input:
    | { mode: 'AMOUNT'; amountKurus: number }
    | { mode: 'ITEMS'; itemIds: string[] }
    | { mode: 'GUESTS' },
): Promise<PaymentSplitResponse> {
  const split = expectRecord(
    await requestPayload(`/api/orders/checks/${checkId}/payment-split`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
    'split',
  );
  if (!isPaymentSplitResponse(split)) {
    throw new ApiError('Hesap bölme bilgisi okunamadı.');
  }
  return split;
}

function isPaymentSplitResponse(value: unknown): value is PaymentSplitResponse {
  return (
    isRecord(value) &&
    (value.mode === 'AMOUNT' || value.mode === 'ITEMS' || value.mode === 'GUESTS') &&
    typeof value.totalKurus === 'number' &&
    Array.isArray(value.shares) &&
    value.shares.every(
      (share) =>
        isRecord(share) &&
        typeof share.label === 'string' &&
        typeof share.amountKurus === 'number' &&
        Array.isArray(share.itemIds) &&
        share.itemIds.every((id) => typeof id === 'string'),
    )
  );
}

export async function closeCheck(checkId: string): Promise<CheckResponse> {
  return readCheck(await requestPayload(`/api/orders/checks/${checkId}/close`, { method: 'POST' }));
}

function isKitchenOrder(value: unknown): value is KitchenOrderResponse {
  return (
    isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.checkId === 'string' &&
    typeof value.tableName === 'string' &&
    typeof value.productNameSnapshot === 'string' &&
    typeof value.quantity === 'number' &&
    (value.note === null || typeof value.note === 'string') &&
    isPreparationArea(value.preparationArea) &&
    (value.preparationStatus === 'SENT' ||
      value.preparationStatus === 'PREPARING' ||
      value.preparationStatus === 'READY') &&
    typeof value.createdAt === 'string' &&
    Array.isArray(value.options) &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        typeof option.groupNameSnapshot === 'string' &&
        typeof option.valueNameSnapshot === 'string',
    )
  );
}

export async function fetchKitchenOrders(
  preparationArea?: PreparationArea,
): Promise<KitchenOrderResponse[]> {
  const query = preparationArea === undefined ? '' : `?preparationArea=${preparationArea}`;
  const orders = expectRecord(await requestPayload(`/api/orders/kitchen${query}`), 'orders');
  if (!Array.isArray(orders) || !orders.every(isKitchenOrder)) {
    throw new ApiError('Hazırlık siparişleri okunamadı.');
  }
  return orders;
}

export async function updateOrderItemStatus(
  itemId: string,
  status: OrderItemStatus,
): Promise<CheckResponse> {
  return readCheck(
    await requestPayload(`/api/orders/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  );
}

function isNamedSales(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.totalKurus === 'number'
  );
}

function isSalesReport(value: unknown): value is SalesReportResponse {
  return (
    isRecord(value) &&
    isRecord(value.range) &&
    typeof value.range.from === 'string' &&
    typeof value.range.to === 'string' &&
    typeof value.revenueKurus === 'number' &&
    typeof value.paidCheckCount === 'number' &&
    typeof value.averageCheckKurus === 'number' &&
    Array.isArray(value.paymentDistribution) &&
    value.paymentDistribution.every(
      (row) =>
        isRecord(row) &&
        (row.method === 'CASH' || row.method === 'CARD' || row.method === 'ACCOUNT') &&
        typeof row.amountKurus === 'number',
    ) &&
    Array.isArray(value.productSales) &&
    value.productSales.every(isNamedSales) &&
    Array.isArray(value.categorySales) &&
    value.categorySales.every(isNamedSales) &&
    Array.isArray(value.staffSales) &&
    value.staffSales.every(isNamedSales) &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.complimentaryTotalKurus === 'number' &&
    typeof value.cancelledItemCount === 'number' &&
    typeof value.cancelledItemTotalKurus === 'number' &&
    Array.isArray(value.hourlySales) &&
    value.hourlySales.every(
      (row) => isRecord(row) && typeof row.hour === 'number' && typeof row.totalKurus === 'number',
    )
  );
}

function queryDateRange(from: string, to: string): string {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function fetchSalesReport(from: string, to: string): Promise<SalesReportResponse> {
  const report = expectRecord(
    await requestPayload(`/api/reports/sales?${queryDateRange(from, to)}`),
    'report',
  );
  if (!isSalesReport(report)) throw new ApiError('Satış raporu okunamadı.');
  return report;
}

export async function fetchDayEnd(date: string): Promise<DayEndResponse> {
  const summary = expectRecord(
    await requestPayload(`/api/reports/day-end?${queryDateRange(date, date)}`),
    'summary',
  );
  if (!isDayEnd(summary)) {
    throw new ApiError('Gün sonu özeti okunamadı.');
  }
  return summary;
}

function isDayEnd(value: unknown): value is DayEndResponse {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.revenueKurus === 'number' &&
    typeof value.cashKurus === 'number' &&
    typeof value.cardKurus === 'number' &&
    typeof value.accountKurus === 'number' &&
    typeof value.openCheckCount === 'number' &&
    typeof value.openAccountBalanceKurus === 'number' &&
    typeof value.discountTotalKurus === 'number' &&
    typeof value.complimentaryTotalKurus === 'number'
  );
}

function isAuditEntry(value: unknown): value is AuditLogListResponse['entries'][number] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.actorUserId === 'string' &&
    typeof value.actorName === 'string' &&
    typeof value.action === 'string' &&
    typeof value.entityType === 'string' &&
    typeof value.entityId === 'string' &&
    (value.metadata === null || isRecord(value.metadata)) &&
    typeof value.createdAt === 'string'
  );
}

function isAuditLogList(value: unknown): value is AuditLogListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.entries) &&
    value.entries.every(isAuditEntry) &&
    Array.isArray(value.actions) &&
    value.actions.every((entry) => typeof entry === 'string') &&
    Array.isArray(value.entityTypes) &&
    value.entityTypes.every((entry) => typeof entry === 'string')
  );
}

export async function fetchAuditLogs(input: {
  from: string;
  to: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
}): Promise<AuditLogListResponse> {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.actorUserId) params.set('actorUserId', input.actorUserId);
  if (input.action) params.set('action', input.action);
  if (input.entityType) params.set('entityType', input.entityType);
  const payload = await requestPayload(`/api/reports/audit?${params.toString()}`);
  if (!isAuditLogList(payload)) {
    throw new ApiError('İşlem geçmişi okunamadı.');
  }
  return payload;
}
