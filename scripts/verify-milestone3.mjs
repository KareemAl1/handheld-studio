import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'docs', 'screenshots', 'milestone-3');
const downloads = join(root, '.cache', 'downloads');
const profile = join(root, '.cache', `milestone3-production-chrome-${process.pid}-${Date.now()}`);
const origin = 'http://127.0.0.1:4173';
const savedKey = 'handheld-studio.saved-build';
const started = Date.now();
const result = {
  passed: false,
  testedAt: new Date().toISOString(),
  browser: null,
  reducedMotion: true,
  checks: [],
  imageDifferences: {},
  pageErrors: [],
  consoleErrors: [],
  failedRequests: [],
  httpErrors: [],
};

function pixelDifference(firstBuffer, secondBuffer) {
  const first = PNG.sync.read(firstBuffer);
  const second = PNG.sync.read(secondBuffer);
  expect([second.width, second.height]).toEqual([first.width, first.height]);
  let changed = 0;
  for (let index = 0; index < first.data.length; index += 4) {
    if (Math.max(
      Math.abs(first.data[index] - second.data[index]),
      Math.abs(first.data[index + 1] - second.data[index + 1]),
      Math.abs(first.data[index + 2] - second.data[index + 2]),
    ) > 18) changed += 1;
  }
  return changed / (first.width * first.height);
}

function inspectExport(buffer) {
  const png = PNG.sync.read(buffer);
  const background = [...png.data.subarray(0, 3)];
  let nonBackground = 0;
  let transparent = 0;
  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] !== 255) transparent += 1;
    if (Math.max(
      Math.abs(png.data[index] - background[0]),
      Math.abs(png.data[index + 1] - background[1]),
      Math.abs(png.data[index + 2] - background[2]),
    ) > 20) nonBackground += 1;
  }
  return {
    width: png.width,
    height: png.height,
    bytes: buffer.length,
    transparentPixels: transparent,
    nonBackgroundFraction: nonBackground / (png.width * png.height),
  };
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let context;
let page;
let failure;
let serverOutput = '';

try {
  await Promise.all([mkdir(artifacts, { recursive: true }), mkdir(downloads, { recursive: true })]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production preview did not start within 15 seconds.')), 15_000);
    server.stdout.on('data', data => {
      serverOutput = (serverOutput + String(data)).slice(-4000);
      if (serverOutput.includes('127.0.0.1:4173')) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', data => { serverOutput = (serverOutput + String(data)).slice(-4000); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Production preview exited with code ${code}.`)); });
    server.once('error', error => { clearTimeout(timer); reject(error); });
  });

  // A fresh project-local profile isolates this verification from personal Chrome
  // state. Closing its persistent context also closes the owned browser process.
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: true, downloadsPath: downloads, acceptDownloads: true,
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  });
  result.browser = context.browser()?.version() ?? 'Installed Chrome';
  await context.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { async writeText(text) { globalThis.__HS_PRODUCTION_CLIPBOARD__ = text; } },
    });
  });
  page = context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => result.failedRequests.push({
    url: request.url(), method: request.method(), error: request.failure()?.errorText ?? 'Unknown request failure',
  }));
  page.on('response', response => {
    if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status(), statusText: response.statusText() });
  });

  const button = name => page.getByRole('button', { name, exact: true });
  const radio = name => page.getByRole('radio', { name, exact: true });
  const canvas = page.locator('canvas');
  const gamePanel = page.locator('.game-panel');
  const feedback = page.getByTestId('build-feedback');
  async function loaded() {
    await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
    expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
  }
  async function buildSelected() {
    for (const name of ['Ember', 'Translucent', 'Ivory']) await expect(radio(name)).toBeChecked();
  }
  async function settledCanvas() {
    await canvas.scrollIntoViewIfNeeded();
    let previous = await canvas.screenshot({ animations: 'disabled' });
    let stableSamples = 0;
    await expect.poll(async () => {
      const next = await canvas.screenshot({ animations: 'disabled' });
      // Play changes the canvas layout. A resize is another unsettled sample,
      // not a product failure or two comparable images.
      const beforeSize = PNG.sync.read(previous), nextSize = PNG.sync.read(next);
      const sameSize = beforeSize.width === nextSize.width && beforeSize.height === nextSize.height;
      stableSamples = sameSize && pixelDifference(previous, next) < 0.0001 ? stableSamples + 1 : 0;
      previous = next;
      return stableSamples;
    }, { message: 'Production canvas should settle under reduced motion', timeout: 12_000, intervals: [100, 150, 250] }).toBeGreaterThanOrEqual(2);
    return previous;
  }

  await page.goto(origin, { waitUntil: 'networkidle' });
  await loaded();
  await expect(radio('Chalk')).toBeChecked();
  const initial = await settledCanvas();
  result.checks.push('built production modules and original model load without development diagnostics');

  await button('Explode').click();
  await button('Play Signal Run').click();
  await expect(button('Start game')).toBeEnabled();
  await expect(button('Exit Play')).toBeVisible();
  const readyScreen = await settledCanvas();
  await canvas.focus();
  await page.keyboard.press('Enter');
  await expect(gamePanel).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('game-score')).toHaveText('10', { timeout: 12_000 });
  const runningScreen = await canvas.screenshot({ animations: 'disabled' });
  result.imageDifferences.gameScreen = pixelDifference(readyScreen, runningScreen);
  expect(result.imageDifferences.gameScreen, 'The game must change pixels on the actual 3D screen').toBeGreaterThan(0.01);
  await page.screenshot({ path: join(artifacts, 'production-game.png'), fullPage: true, animations: 'disabled' });
  await expect(gamePanel).toHaveAttribute('data-phase', 'over', { timeout: 12_000 });
  await expect(button('Restart game')).toBeEnabled();
  await button('Restart game').click();
  await expect(gamePanel).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('game-score')).toHaveText('0');
  await button('Exit Play').click();
  await expect(button('Play Signal Run')).toBeFocused();
  await expect(page.getByRole('slider', { name: 'Assembly', exact: true })).toHaveValue('0');
  result.checks.push('Play assembles the device; real screen runs start, collection, game over, restart, and Exit');

  for (const name of ['Ember', 'Translucent', 'Ivory']) await radio(name).check();
  await buildSelected();
  const configured = await settledCanvas();
  result.imageDifferences.configuredDevice = pixelDifference(initial, configured);
  expect(result.imageDifferences.configuredDevice).toBeGreaterThan(0.02);
  await button('Save build').click();
  await expect(feedback).toHaveText('Build saved in this browser.');
  const saved = { version: 2, shell: 'ember', buttons: 'ivory', finish: 'translucent' };
  expect(await page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), savedKey)).toEqual(saved);
  await page.reload({ waitUntil: 'networkidle' });
  await loaded();
  await buildSelected();
  await expect(feedback).toContainText('Your saved build was restored.');
  result.imageDifferences.reloadedDevice = pixelDifference(configured, await settledCanvas());
  expect(result.imageDifferences.reloadedDevice).toBeLessThan(0.005);
  result.checks.push('save and full reload restore shell, material, and button choices in both controls and rendered pixels');

  await button('Copy share link').click();
  await expect(feedback).toHaveText('Share link copied.');
  const link = await page.evaluate(() => globalThis.__HS_PRODUCTION_CLIPBOARD__);
  expect(link).toBe(`${origin}/?v=2&s=ember&b=ivory&f=translucent`);
  await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toHaveValue(link);
  await expect(page.getByText('Localhost links only work locally until deployment.', { exact: true })).toBeVisible();
  result.shareLink = link;
  // Store a deliberately different build so URL restoration cannot pass by
  // accidentally falling back to the same saved configuration.
  await button('Reset build').click();
  await button('Save build').click();
  await expect(feedback).toHaveText('Build saved in this browser.');
  await page.goto(link, { waitUntil: 'networkidle' });
  await loaded();
  await buildSelected();
  await expect(feedback).toContainText('Shared build loaded.');
  expect(await page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), savedKey)).toEqual({
    version: 2, shell: 'chalk', buttons: 'charcoal', finish: 'solid',
  });
  result.imageDifferences.sharedDevice = pixelDifference(configured, await settledCanvas());
  expect(result.imageDifferences.sharedDevice).toBeLessThan(0.005);
  result.checks.push('copied version-2 URL restores all three choices and takes precedence without overwriting the distinct saved build');

  await expect(button('Export PNG')).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    button('Export PNG').click(),
  ]);
  expect(download.suggestedFilename()).toBe('hs-01-ember-translucent-ivory.png');
  expect(await download.failure()).toBeNull();
  const exportedPath = join(artifacts, 'production-export.png');
  await download.saveAs(exportedPath);
  result.export = inspectExport(await readFile(exportedPath));
  expect([result.export.width, result.export.height]).toEqual([1600, 1200]);
  expect(result.export.transparentPixels).toBe(0);
  expect(result.export.nonBackgroundFraction, 'Export must contain a visible product against its background').toBeGreaterThan(0.05);
  expect(result.export.nonBackgroundFraction).toBeLessThan(0.85);
  await expect(feedback).toContainText('PNG ready.');
  await expect(page.getByRole('link', { name: 'Download PNG', exact: true })).toBeVisible();
  await buildSelected();
  result.checks.push('download event yields a decoded, opaque, nonblank 1600×1200 PNG with the correct configuration filename');

  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({ path: join(artifacts, 'production-desktop.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
  expect(result.pageErrors).toEqual([]);
  expect(result.consoleErrors).toEqual([]);
  expect(result.failedRequests).toEqual([]);
  expect(result.httpErrors).toEqual([]);
  result.checks.push('no page errors, console errors, failed requests, or HTTP responses at or above 400');
  result.passed = true;
} catch (error) {
  failure = error;
  result.failure = error instanceof Error ? error.message : String(error);
  result.previewOutput = serverOutput;
  if (page && !page.isClosed()) {
    try {
      await page.screenshot({ path: join(artifacts, 'production-failure.png'), fullPage: true });
    } catch (screenshotError) {
      result.failureScreenshotError = String(screenshotError);
    }
  }
} finally {
  try {
    result.elapsedMs = Date.now() - started;
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(artifacts, 'production-smoke.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try { await context?.close(); } finally { server.kill(); }
  }
}
if (failure) throw failure;
