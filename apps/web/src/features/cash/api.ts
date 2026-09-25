/** Kasa oturumu (vardiya) uçları. */
import { type CashMovementType, type CashSessionResponse } from '@kafe/contracts';
import {
  ApiError,
  isRecord,
  requestPayload,
  expectRecord,
  isNullableString,
  isNullableNumber,
} from '../../shared/api/http';

function isCashMovement(value: unknown): value is CashSessionResponse['movements'][number] {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.type === 'IN' || value.type === 'OUT') &&
    typeof value.amountKurus === 'number' &&
    typeof value.reason === 'string' &&
    typeof value.actorName === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isCashSession(value: unknown): value is CashSessionResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.status === 'OPEN' || value.status === 'CLOSED') &&
    typeof value.openedAt === 'string' &&
    typeof value.openedByName === 'string' &&
    typeof value.openingCashKurus === 'number' &&
    typeof value.cashSalesKurus === 'number' &&
    typeof value.cashInKurus === 'number' &&
    typeof value.cashOutKurus === 'number' &&
    typeof value.expectedCashKurus === 'number' &&
    isNullableNumber(value.countedCashKurus) &&
    isNullableNumber(value.differenceKurus) &&
    isNullableString(value.closedAt) &&
    isNullableString(value.closedByName) &&
    isNullableString(value.openingNote) &&
    isNullableString(value.closingNote) &&
    Array.isArray(value.movements) &&
    value.movements.every(isCashMovement)
  );
}

function readCashSession(payload: unknown): CashSessionResponse {
  const session = expectRecord(payload, 'session');
  if (!isCashSession(session)) throw new ApiError('Kasa bilgisi okunamadı.');
  return session;
}

export async function fetchCurrentCashSession(): Promise<CashSessionResponse | null> {
  const session = expectRecord(await requestPayload('/api/cash/current'), 'session');
  if (session === null) return null;
  if (!isCashSession(session)) throw new ApiError('Kasa bilgisi okunamadı.');
  return session;
}

export async function fetchCashSessions(): Promise<CashSessionResponse[]> {
  const rows = expectRecord(await requestPayload('/api/cash/sessions'), 'sessions');
  if (!Array.isArray(rows) || !rows.every(isCashSession)) {
    throw new ApiError('Kasa geçmişi okunamadı.');
  }
  return rows;
}

export function openCashSession(input: {
  openingCashKurus: number;
  note: string | null;
}): Promise<CashSessionResponse> {
  return requestPayload('/api/cash/open', { method: 'POST', body: JSON.stringify(input) }).then(
    readCashSession,
  );
}

export function addCashMovement(input: {
  type: CashMovementType;
  amountKurus: number;
  reason: string;
}): Promise<CashSessionResponse> {
  return requestPayload('/api/cash/current/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(readCashSession);
}

export function closeCashSession(input: {
  countedCashKurus: number;
  note: string | null;
}): Promise<CashSessionResponse> {
  return requestPayload('/api/cash/current/close', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(readCashSession);
}
