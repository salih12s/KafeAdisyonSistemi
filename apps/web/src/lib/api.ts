import { HEALTH_ENDPOINT, isHealthResponse, type HealthResponse } from '@kafe/contracts';

export class ApiError extends Error {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Sağlık durumunu okur.
 * Veritabanı kapalıyken API 503 döner; bu bir hata değil, gösterilmesi gereken bir durumdur.
 * Bu yüzden 503 yanıtı da geçerli gövdeyse başarı sayılır.
 */
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

  if (isHealthResponse(payload)) {
    return payload;
  }

  throw new ApiError('Sunucudan beklenmeyen bir yanıt alındı.', response.status);
}
