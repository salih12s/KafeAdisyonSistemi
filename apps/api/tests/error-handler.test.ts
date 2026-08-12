import { describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { API_ERROR_CODES } from '@kafe/contracts';
import { AppError, ValidationError } from '../src/errors/app-error';
import { createErrorHandler } from '../src/middleware/error-handler';
import { createSilentLogger } from '../src/lib/logger';

function buildApp(options: { exposeInternalMessage: boolean }): Express {
  const app = express();

  app.use(express.json({ limit: '1kb' }));

  app.get('/patla', () => {
    throw new Error('Veritabanı parolası gizli-deger ile bağlanılamadı');
  });

  app.get('/async-patla', async () => {
    await Promise.resolve();
    throw new Error('Eşzamansız hata');
  });

  app.get('/kural-disi', () => {
    throw new ValidationError('Masa numarası zorunludur.', ['tableNumber: eksik']);
  });

  app.get('/servis-yok', () => {
    throw new AppError('Servis geçici olarak kullanılamıyor.', 503, API_ERROR_CODES.SERVICE_UNAVAILABLE);
  });

  app.post('/govde', (req, res) => {
    res.json({ alindi: req.body });
  });

  app.use(createErrorHandler(createSilentLogger(), options.exposeInternalMessage));

  return app;
}

describe('Merkezî hata yönetimi', () => {
  it('beklenmeyen hatayı 500 ve sabit gövde biçimiyle döner', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false })).get('/patla');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Sunucuda beklenmeyen bir hata oluştu.',
      },
    });
  });

  it('üretim davranışında hata mesajını ve stack trace bilgisini sızdırmaz', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false })).get('/patla');
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('gizli-deger');
    expect(serialized).not.toContain('stack');
  });

  it('eşzamansız hataları da yakalar', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false })).get('/async-patla');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
  });

  it('bilinen uygulama hatasının kodunu, mesajını ve ayrıntılarını korur', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false })).get('/kural-disi');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.error.message).toBe('Masa numarası zorunludur.');
    expect(response.body.error.details).toEqual(['tableNumber: eksik']);
  });

  it('özel durum kodlu uygulama hatasını olduğu gibi iletir', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false })).get('/servis-yok');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
  });

  it('bozuk JSON gövdesini 400 olarak yanıtlar', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false }))
      .post('/govde')
      .set('Content-Type', 'application/json')
      .send('{"eksik":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(API_ERROR_CODES.VALIDATION_ERROR);
  });

  it('sınırı aşan gövdeyi 413 olarak yanıtlar', async () => {
    const response = await request(buildApp({ exposeInternalMessage: false }))
      .post('/govde')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ dolgu: 'x'.repeat(4096) }));

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe(API_ERROR_CODES.PAYLOAD_TOO_LARGE);
  });

  it('geliştirme davranışında hata mesajını görünür kılar', async () => {
    const response = await request(buildApp({ exposeInternalMessage: true })).get('/patla');

    expect(response.status).toBe(500);
    expect(response.body.error.message).toContain('bağlanılamadı');
  });
});
