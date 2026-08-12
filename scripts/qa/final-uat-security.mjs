import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.UAT_BASE_URL ?? 'http://127.0.0.1:3500';
const productionUrl = process.env.UAT_PRODUCTION_URL ?? 'http://127.0.0.1:3300';
const ownerPassword = process.env.UAT_OWNER_PASSWORD;
const outputDirectory = process.env.UAT_OUTPUT_DIR;

if (!ownerPassword || !outputDirectory) {
  throw new Error('UAT_OWNER_PASSWORD ve UAT_OUTPUT_DIR zorunludur.');
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { response, payload };
}

const login = await request(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'uat_owner', password: ownerPassword }),
});
assert.equal(login.response.status, 200);
const setCookie = login.response.headers.get('set-cookie') ?? '';
const cookie = setCookie.split(';', 1)[0] ?? '';
assert.match(cookie, /^kafe_session=/);

const unauthorized = await request(`${baseUrl}/api/staff`);
assert.equal(unauthorized.response.status, 401);

const injectionSearch = await request(
  `${baseUrl}/api/accounts?search=${encodeURIComponent("' OR 1=1 --")}`,
  { headers: { cookie } },
);
assert.equal(injectionSearch.response.status, 200);
assert.ok(Array.isArray(injectionSearch.payload.customers));
assert.equal(injectionSearch.payload.customers.length, 0);

const unknownUser = await request(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'olmayan-kullanici', password: ownerPassword }),
});
const wrongPassword = await request(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'uat_owner', password: 'YanlisParola12!' }),
});
assert.equal(unknownUser.response.status, 401);
assert.equal(wrongPassword.response.status, 401);
assert.equal(unknownUser.payload.error.message, wrongPassword.payload.error.message);

const injectionLogin = await request(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: "admin' OR 1=1 --", password: ownerPassword }),
});
assert.equal(injectionLogin.response.status, 400);

const rateStatuses = [];
for (let attempt = 0; attempt < 9; attempt += 1) {
  const result = await request(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'uat_owner', password: 'YanlisParola12!' }),
  });
  rateStatuses.push(result.response.status);
}
assert.ok(rateStatuses.includes(429));
assert.equal(rateStatuses.at(-1), 429);

const oversized = await request(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'uat_owner', password: 'x'.repeat(1_100_000) }),
});
assert.equal(oversized.response.status, 413);

const productionPage = await request(productionUrl);
assert.equal(productionPage.response.status, 200);
const contentSecurityPolicy = productionPage.response.headers.get('content-security-policy');
assert.ok(contentSecurityPolicy);
assert.equal(productionPage.response.headers.get('x-powered-by'), null);
assert.equal(productionPage.response.headers.get('x-content-type-options'), 'nosniff');

const result = {
  unauthorizedStatus: unauthorized.response.status,
  parameterizedInjectionSearchCount: injectionSearch.payload.customers.length,
  genericCredentialErrorMatched: true,
  injectionLoginStatus: injectionLogin.response.status,
  rateLimitStatuses: rateStatuses,
  oversizedBodyStatus: oversized.response.status,
  productionHeaders: {
    contentSecurityPolicy: Boolean(contentSecurityPolicy),
    xPoweredByHidden: true,
    noSniff: true,
  },
};

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, 'security-baseline-result.json'),
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`${JSON.stringify(result)}\n`);
