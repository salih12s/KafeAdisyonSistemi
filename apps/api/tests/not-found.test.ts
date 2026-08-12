import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_ERROR_CODES } from '@kafe/contracts';
import { createTestApp } from './helpers/test-app';

describe('Bilinmeyen yollar', () => {
  it('/api altındaki tanımsız uç için JSON 404 döner', async () => {
    const app = createTestApp({ databaseConnected: true });

    const response = await request(app).get('/api/olmayan-uc');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
    expect(response.body.error.message).toContain('/api/olmayan-uc');
  });

  it('POST istekleri için de 404 döner', async () => {
    const app = createTestApp({ databaseConnected: true });

    const response = await request(app).post('/api/olmayan-uc').send({ deneme: true });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });

  it('web derlemesi sunulmazken /api dışındaki yollar da 404 döner', async () => {
    const app = createTestApp({ databaseConnected: true });

    const response = await request(app).get('/masalar');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(API_ERROR_CODES.NOT_FOUND);
  });
});
