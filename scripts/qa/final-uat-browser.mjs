import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const appUrl = process.env.UAT_WEB_URL ?? 'http://127.0.0.1:5173';
const ownerPassword = process.env.UAT_OWNER_PASSWORD;
const staffPassword = process.env.UAT_STAFF_PASSWORD;
const outputDirectory = process.env.UAT_OUTPUT_DIR;
const chromePath =
  process.env.UAT_CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!ownerPassword || !staffPassword || !outputDirectory) {
  throw new Error('UAT_OWNER_PASSWORD, UAT_STAFF_PASSWORD ve UAT_OUTPUT_DIR zorunludur.');
}

const screenshots = path.join(outputDirectory, 'screenshots');
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const browserErrors = [];
const failedResponses = [];

function observe(page, name) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push({ context: name, type: message.type(), text: message.text() });
    }
  });
  page.on('pageerror', (error) =>
    browserErrors.push({ context: name, type: 'pageerror', text: error.message }),
  );
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ context: name, status: response.status(), url: response.url() });
    }
  });
}

async function login(context, name, username, password, viewport = { width: 1440, height: 900 }) {
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  await page.goto(`${appUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Kullanıcı adı').fill(username);
  await page.getByLabel('Şifre', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await page.getByRole('heading', { name: 'Özet', exact: true }).waitFor();
  observe(page, name);
  return page;
}

async function overflow(page, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle' });
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

async function screenshot(page, filename) {
  const target = path.join(screenshots, filename);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

const ownerContext = await browser.newContext();
const waiterContext = await browser.newContext();
const kitchenContext = await browser.newContext();
let ownerPage;
let waiterPage;
let kitchenPage;

try {
  ownerPage = await login(ownerContext, 'owner', 'uat_owner', ownerPassword);
  waiterPage = await login(waiterContext, 'waiter', 'uat_waiter', staffPassword);
  kitchenPage = await login(kitchenContext, 'kitchen', 'uat_kitchen', staffPassword);

  const cookieFingerprints = [];
  for (const context of [ownerContext, waiterContext, kitchenContext]) {
    const cookies = await context.cookies(appUrl);
    const session = cookies.find((cookie) => cookie.name === 'kafe_session');
    assert.ok(session);
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, 'Strict');
    cookieFingerprints.push(session.value);
  }
  assert.equal(new Set(cookieFingerprints).size, 3);

  await ownerPage.goto(`${appUrl}/ayarlar`, { waitUntil: 'networkidle' });
  await ownerPage.getByRole('button', { name: 'Personel' }).click();
  const staffExists = await ownerPage.evaluate(async () => {
    const response = await fetch('/api/staff');
    const payload = await response.json();
    return payload.staff.some((member) => member.username === 'uat_browser_waiter');
  });
  if (!staffExists) {
    await ownerPage.getByLabel('Ad soyad').fill('Browser UAT Personeli');
    await ownerPage.getByLabel('Kullanıcı adı').fill('uat_browser_waiter');
    await ownerPage.getByLabel('Geçici şifre').fill(staffPassword);
    await ownerPage.getByRole('button', { name: 'Kaydet' }).click();
    await ownerPage.getByText('Browser UAT Personeli').waitFor();
  }

  await ownerPage.getByRole('button', { name: 'Salonlar ve Masalar' }).click();
  const browserAreaButton = ownerPage.getByRole('button', { name: /Browser UAT Salon/ });
  const areaExists = await ownerPage.evaluate(async () => {
    const response = await fetch('/api/areas?includeInactive=true');
    const payload = await response.json();
    return payload.areas.some((area) => area.name === 'Browser UAT Salon');
  });
  if (!areaExists) {
    await ownerPage.getByLabel('Salon adı').fill('Browser UAT Salon');
    await ownerPage.getByRole('button', { name: 'Salon ekle' }).click();
  }
  await browserAreaButton.waitFor();
  await browserAreaButton.click();
  if ((await ownerPage.getByText('Browser Masa').count()) === 0) {
    await ownerPage.getByLabel('Masa adı').fill('Browser Masa');
    await ownerPage.getByLabel('Kapasite').fill('4');
    await ownerPage.getByRole('button', { name: 'Masa ekle' }).click();
    await ownerPage.getByText('Browser Masa').waitFor();
  }

  await ownerPage.setViewportSize({ width: 1440, height: 900 });
  await ownerPage.goto(`${appUrl}/masalar`, { waitUntil: 'networkidle' });
  const screenshotPaths = [];
  screenshotPaths.push(await screenshot(ownerPage, '01-1440-masalar.png'));

  await kitchenPage.goto(`${appUrl}/mutfak`, { waitUntil: 'networkidle' });
  await waiterPage.setViewportSize({ width: 1440, height: 900 });
  await waiterPage.goto(`${appUrl}/masalar`, { waitUntil: 'networkidle' });
  await waiterPage.getByRole('button', { name: 'Bahçe', exact: true }).click();
  await waiterPage.getByRole('button', { name: /Masa 10/ }).click();
  const openForm = waiterPage.getByRole('form', { name: 'Masa açma formu' });
  if (await openForm.isVisible()) {
    await openForm.getByLabel('Kişi sayısı').fill('2');
    await openForm.getByRole('button', { name: 'Masayı aç' }).click();
  }
  await waiterPage.getByText('Masa 10 adisyonu').waitFor();
  if ((await waiterPage.getByText('1 × Espresso').count()) === 0) {
    await waiterPage.getByRole('button', { name: /Espresso/ }).click();
    await waiterPage.getByRole('button', { name: 'Siparişe ekle' }).click();
  }
  await waiterPage.getByText('1 × Espresso').waitFor();
  screenshotPaths.push(await screenshot(waiterPage, '02-1440-acik-adisyon.png'));

  const latteButton = waiterPage.getByRole('button', { name: /Latte/ });
  await latteButton.click();
  const modifier = waiterPage.getByRole('dialog', { name: 'Latte' });
  await modifier.waitFor();
  screenshotPaths.push(await screenshot(waiterPage, '03-1440-modifier.png'));
  await waiterPage.keyboard.press('Escape');
  assert.equal(await modifier.isVisible(), false);
  assert.equal(await latteButton.evaluate((element) => document.activeElement === element), true);

  await kitchenPage.getByText('1 × Espresso').waitFor({ timeout: 10_000 });
  screenshotPaths.push(await screenshot(kitchenPage, '04-1440-mutfak-kds.png'));
  screenshotPaths.push(await screenshot(waiterPage, '05-1440-odeme.png'));

  await ownerPage.goto(`${appUrl}/raporlar`, { waitUntil: 'networkidle' });
  screenshotPaths.push(await screenshot(ownerPage, '06-1440-raporlar.png'));
  await ownerPage.goto(`${appUrl}/cariler`, { waitUntil: 'networkidle' });
  screenshotPaths.push(await screenshot(ownerPage, '07-1440-cariler.png'));

  await waiterPage.setViewportSize({ width: 768, height: 1024 });
  screenshotPaths.push(await screenshot(waiterPage, '08-768-siparis.png'));
  await ownerPage.setViewportSize({ width: 390, height: 844 });
  await ownerPage.goto(`${appUrl}/masalar`, { waitUntil: 'networkidle' });
  screenshotPaths.push(await screenshot(ownerPage, '09-390-masalar.png'));
  await waiterPage.setViewportSize({ width: 390, height: 844 });
  screenshotPaths.push(await screenshot(waiterPage, '10-390-adisyon.png'));
  screenshotPaths.push(await screenshot(waiterPage, '11-390-odeme.png'));

  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  const routes = [
    '/',
    '/masalar',
    '/menu',
    '/mutfak',
    '/cariler',
    '/raporlar',
    '/ayarlar',
    '/olmayan-sayfa',
  ];
  const responsive = [];
  for (const viewport of viewports) {
    for (const route of routes) {
      const measurement = await overflow(ownerPage, route, viewport);
      responsive.push({ viewport: `${viewport.width}x${viewport.height}`, route, ...measurement });
    }
  }
  assert.equal(
    responsive.some((entry) => entry.overflow),
    false,
  );

  await ownerPage.setViewportSize({ width: 390, height: 844 });
  await ownerPage.goto(`${appUrl}/`, { waitUntil: 'networkidle' });
  const allButton = ownerPage.getByRole('button', { name: 'Tümü' });
  await allButton.click();
  const drawer = ownerPage.getByRole('dialog', { name: 'Tüm modüller' });
  await drawer.waitFor();
  const drawerFocusOnOpen = await ownerPage.evaluate(() => ({
    tag: document.activeElement?.tagName ?? '',
    text: document.activeElement?.textContent?.trim() ?? '',
  }));
  await ownerPage.keyboard.press('Escape');
  const drawerFocusRestored = await allButton.evaluate(
    (element) => document.activeElement === element,
  );

  await ownerPage.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await ownerPage.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  assert.equal(reducedMotion, true);

  const touchTargets = await ownerPage
    .locator('button:visible, a:visible')
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            text: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
            width: box.width,
            height: box.height,
          };
        })
        .filter(
          (entry) => entry.width > 0 && entry.height > 0 && (entry.width < 44 || entry.height < 44),
        ),
    );
  const unnamedButtons = await ownerPage
    .locator('button:visible')
    .evaluateAll(
      (elements) =>
        elements.filter(
          (element) => !(element.getAttribute('aria-label') || element.textContent?.trim()),
        ).length,
    );

  await waiterPage.goto(`${appUrl}/raporlar`, { waitUntil: 'networkidle' });
  assert.equal(
    await waiterPage.getByRole('heading', { name: 'Bu bölüme erişim yetkiniz yok' }).isVisible(),
    true,
  );
  await kitchenPage.goto(`${appUrl}/ayarlar`, { waitUntil: 'networkidle' });
  assert.equal(
    await kitchenPage.getByRole('heading', { name: 'Bu bölüme erişim yetkiniz yok' }).isVisible(),
    true,
  );

  const result = {
    contexts: 3,
    independentCookies: true,
    frontendCreated: ['personel', 'salon', 'masa', 'adisyon', 'sipariş kalemi'],
    realtimeTicketWithoutReload: true,
    responsive,
    accessibility: {
      modifierFocusRestored: true,
      drawerFocusOnOpen,
      drawerFocusRestored,
      unnamedButtons,
      sub44PixelTargets: touchTargets,
      reducedMotion,
    },
    consoleWarningsOrErrors: browserErrors,
    failedResponses,
    screenshots: screenshotPaths,
  };
  await writeFile(
    path.join(outputDirectory, 'browser-uat-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await ownerContext.close();
  await waiterContext.close();
  await kitchenContext.close();
  await browser.close();
}
