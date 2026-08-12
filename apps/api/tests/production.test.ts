import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';

const created: string[] = [];
afterEach(async () => {
  await Promise.all(created.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('Phase 7 production hazırlığı', () => {
  it('React SPA fallbackını API 404 davranışını bozmadan aynı origin üzerinde sunar', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'kafe-web-'));
    created.push(directory);
    await writeFile(path.join(directory, 'index.html'), '<html><body>Kafe SPA</body></html>');
    const app = createTestApp({ databaseConnected: true, webDistPath: directory });
    const spa = await request(app).get('/raporlar');
    expect(spa.status).toBe(200);
    expect(spa.text).toContain('Kafe SPA');
    const api = await request(app).get('/api/bilinmeyen');
    expect(api.status).toBe(404);
    expect(api.headers['content-type']).toContain('application/json');
  });
});
