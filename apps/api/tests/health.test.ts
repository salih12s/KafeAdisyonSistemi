import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { HEALTH_ENDPOINT, isHealthResponse } from '@kafe/contracts';
import { createTestApp } from './helpers/test-app';

describe('GET /api/health', () => {
  it('veritabanı erişilebilirken 200 ve ok durumu döner', async () => {
    const app = createTestApp({ databaseConnected: true });

    const response = await request(app).get(HEALTH_ENDPOINT);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      database: 'connected',
      environment: 'test',
    });
    expect(isHealthResponse(response.body)).toBe(true);
  });

  it('zaman damgası geçerli bir ISO tarihidir', async () => {
    const app = createTestApp({ databaseConnected: true });

    const response = await request(app).get(HEALTH_ENDPOINT);
    const timestamp: unknown = response.body.timestamp;

    expect(typeof timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(String(timestamp)))).toBe(false);
  });

  it('veritabanına ulaşılamadığında 503 ve degraded durumu döner, stack trace sızdırmaz', async () => {
    const app = createTestApp({ databaseConnected: false });

    const response = await request(app).get(HEALTH_ENDPOINT);

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      database: 'disconnected',
    });
    expect(JSON.stringify(response.body)).not.toContain('at ');
  });
});
