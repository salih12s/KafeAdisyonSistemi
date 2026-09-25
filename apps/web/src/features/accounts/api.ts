/** Cari müşteri ve cari hareket uçları. */
import {
  type CustomerResponse,
  type CustomerStatementResponse,
  type AccountEntryType,
} from '@kafe/contracts';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

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
