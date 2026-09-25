/** Tüm API modüllerinin kullandığı istek ve yanıt doğrulama altyapısı. */
import { CREDENTIALS_MODE, apiUrl } from '../config/api-base';

export class ApiError extends Error {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  return typeof payload.error.message === 'string' ? payload.error.message : undefined;
}

export async function requestPayload(path: string, init?: RequestInit): Promise<unknown> {
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

export function expectRecord(payload: unknown, key: string): unknown {
  if (!isRecord(payload) || !(key in payload)) {
    throw new ApiError('Sunucudan beklenmeyen bir yanıt alındı.');
  }
  return payload[key];
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}
