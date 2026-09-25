/** Giriş, çıkış, oturum ve şifre değiştirme uçları. */
import { USER_ROLES, type CurrentUser, type UserRole } from '@kafe/contracts';
import { ApiError, isRecord, requestPayload, expectRecord } from '../../shared/api/http';

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.some((role) => role === value);
}

export function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.username === 'string' &&
    isUserRole(value.role)
  );
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
