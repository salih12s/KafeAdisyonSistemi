/** Personel, salon/masa yönetimi ve işlem geçmişi uçları. */
import {
  type CafeTableResponse,
  type DiningAreaResponse,
  type FloorPlanResponse,
  type StaffMember,
  type UserRole,
  type AuditLogListResponse,
} from '@kafe/contracts';
import { isCurrentUser } from '../auth/api';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

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
