/** Canlı demo (ADR-026): demo bilgisi ve rol seçerek şifresiz demo girişi. */
import {
  DEMO_ENDPOINT,
  DEMO_LOGIN_ENDPOINT,
  USER_ROLES,
  type CurrentUser,
  type DemoAccount,
  type DemoInfoResponse,
  type UserRole,
} from '@kafe/contracts';
import { ApiError, expectRecord, isRecord, requestPayload } from '../../shared/api/http';
import { isCurrentUser } from '../auth/api';

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.some((role) => role === value);
}

function isDemoAccount(value: unknown): value is DemoAccount {
  return (
    isRecord(value) &&
    isUserRole(value.role) &&
    typeof value.fullName === 'string' &&
    typeof value.username === 'string'
  );
}

export function isDemoInfo(value: unknown): value is DemoInfoResponse {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.resetting === 'boolean' &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isDemoAccount)
  );
}

export async function fetchDemoInfo(): Promise<DemoInfoResponse> {
  const payload = await requestPayload(DEMO_ENDPOINT);
  if (!isDemoInfo(payload)) throw new ApiError('Demo bilgisi okunamadı.');
  return payload;
}

export async function demoLogin(role: UserRole): Promise<CurrentUser> {
  const payload = await requestPayload(DEMO_LOGIN_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  const user = expectRecord(payload, 'user');
  if (!isCurrentUser(user)) throw new ApiError('Kullanıcı bilgisi okunamadı.');
  return user;
}
