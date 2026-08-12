import { API_PREFIX, type AppEnvironment } from './common.js';

export const HEALTH_ENDPOINT = `${API_PREFIX}/health`;

export type HealthStatus = 'ok' | 'degraded';
export type DatabaseStatus = 'connected' | 'disconnected';

/** GET /api/health yanıtı. Veritabanı erişilemezse status "degraded" ve HTTP 503 döner. */
export interface HealthResponse {
  status: HealthStatus;
  database: DatabaseStatus;
  timestamp: string;
  environment: AppEnvironment;
}

const HEALTH_STATUSES: readonly string[] = ['ok', 'degraded'];
const DATABASE_STATUSES: readonly string[] = ['connected', 'disconnected'];
const ENVIRONMENTS: readonly string[] = ['development', 'test', 'production'];

/**
 * Ağdan gelen gövdeyi tip iddiası kullanmadan doğrular.
 * İstemci tarafında `as HealthResponse` yerine bu kontrol kullanılır.
 */
export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('status' in value) || !isOneOf(value.status, HEALTH_STATUSES)) {
    return false;
  }

  if (!('database' in value) || !isOneOf(value.database, DATABASE_STATUSES)) {
    return false;
  }

  if (!('environment' in value) || !isOneOf(value.environment, ENVIRONMENTS)) {
    return false;
  }

  return 'timestamp' in value && typeof value.timestamp === 'string';
}

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}
