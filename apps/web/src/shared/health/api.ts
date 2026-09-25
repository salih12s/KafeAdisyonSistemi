/** Sunucu ve veritabanı sağlık kontrolü. */
import { CREDENTIALS_MODE, apiUrl } from '../config/api-base';
import { HEALTH_ENDPOINT, isHealthResponse, type HealthResponse } from '@kafe/contracts';
import { ApiError } from '../api/http';

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
