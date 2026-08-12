import {
  HEALTH_ENDPOINT,
  USER_ROLES,
  isHealthResponse,
  isOptionSelectionType,
  isPreparationArea,
  type BusinessSettingsResponse,
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

function isBusinessSettings(value: unknown): value is BusinessSettingsResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.businessName === 'string' &&
    (value.phone === null || typeof value.phone === 'string') &&
    (value.address === null || typeof value.address === 'string') &&
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
    response = await fetch(path, {
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
  if (!isRecord(payload) || !(key in payload))
    {throw new ApiError('Sunucudan beklenmeyen bir yanıt alındı.');}
  return payload[key];
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(HEALTH_ENDPOINT, {
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
  if (!isRecord(payload) || typeof payload.initialized !== 'boolean')
    {throw new ApiError('Kurulum durumu okunamadı.');}
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
  if (!Array.isArray(staff) || !staff.every(isStaffMember))
    {throw new ApiError('Personel listesi okunamadı.');}
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

export async function fetchBusinessSettings(): Promise<BusinessSettingsResponse> {
  const settings = expectRecord(await requestPayload('/api/business-settings'), 'settings');
  if (!isBusinessSettings(settings)) throw new ApiError('İşletme bilgileri okunamadı.');
  return settings;
}

export function updateBusinessSettings(input: {
  businessName: string;
  phone: string;
  address: string;
}): Promise<unknown> {
  return requestPayload('/api/business-settings', { method: 'PATCH', body: JSON.stringify(input) });
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
  if (!Array.isArray(tables) || !tables.every(isTable))
    {throw new ApiError('Masa listesi okunamadı.');}
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
  if (!Array.isArray(categories) || !categories.every(isCategory))
    {throw new ApiError('Kategori listesi okunamadı.');}
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
  if (!Array.isArray(products) || !products.every(isProduct))
    {throw new ApiError('Ürün listesi okunamadı.');}
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
  if (!Array.isArray(groups) || !groups.every(isOptionGroup))
    {throw new ApiError('Seçenek listesi okunamadı.');}
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
