/* global requestAnimationFrame, scrollTo */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = new URL('../docs/screenshots/milestone-2/', import.meta.url);
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

// Compare actual canvas pixels rather than PNG encoding or internal scene state.
function pixelDifference(firstBuffer, secondBuffer) {
  const first = PNG.sync.read(firstBuffer);
  const second = PNG.sync.read(secondBuffer);
  expect([second.width, second.height]).toEqual([first.width, first.height]);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if (Math.max(Math.abs(first.data[i] - second.data[i]), Math.abs(first.data[i + 1] - second.data[i + 1]), Math.abs(first.data[i + 2] - second.data[i + 2])) > 18) changed++;
  }
  return changed / (first.width * first.height);
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
let page;
let failure;
let serverOutput = '';
try {
  await mkdir(artifacts, { recursive: true });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production preview did not start')), 15_000);
    server.stdout.on('data', (data) => {
      serverOutput = (serverOutput + String(data)).slice(-4000);
      if (serverOutput.includes('127.0.0.1:4173')) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', (data) => {
      serverOutput = (serverOutput + String(data)).slice(-4000);
    });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  result.browser = browser.version();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => result.failedRequests.push({
    url: request.url(), method: request.method(), error: request.failure()?.errorText ?? 'Unknown request failure',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) result.httpErrors.push({ url: response.url(), status: response.status(), statusText: response.statusText() });
  });

  const canvas = page.locator('canvas');
  const radio = (name) => page.getByRole('radio', { name, exact: true });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const slider = page.getByRole('slider', { name: 'Assembly', exact: true });
  async function settledCanvas() {
    await canvas.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    let previous = await canvas.screenshot({ animations: 'disabled' });
    let stableSamples = 0;
    await expect.poll(async () => {
      const next = await canvas.screenshot({ animations: 'disabled' });
      stableSamples = pixelDifference(previous, next) < 0.0001 ? stableSamples + 1 : 0;
      previous = next;
      return stableSamples;
    }, { message: 'Production canvas should settle under reduced motion', timeout: 10_000, intervals: [100, 150, 250] }).toBeGreaterThanOrEqual(2);
    return previous;
  }
  function changed(name, before, after, minimum) {
    const difference = pixelDifference(before, after);
    result.imageDifferences[name] = difference;
    expect(difference, `${name} must change the rendered canvas`).toBeGreaterThan(minimum);
  }
  async function capture(name) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: fileURLToPath(new URL(name, artifacts)), fullPage: true, animations: 'disabled' });
  }

  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  await expect(radio('Chalk')).toBeChecked();
  await expect(radio('Charcoal')).toBeChecked();
  await expect(radio('Solid')).toBeChecked();
  await expect(slider).toHaveValue('0');
  await button('Fit').click();
  const initial = await settledCanvas();
  result.checks.push('production module and asset loading');

  await radio('Graphite').check();
  await expect(radio('Graphite')).toBeChecked();
  await expect(radio('Charcoal')).toBeChecked();
  await expect(radio('Solid')).toBeChecked();
  changed('shellColor', initial, await settledCanvas(), 0.02);
  await radio('Chalk').check();
  const chalk = await settledCanvas();
  result.checks.push('independent shell color changes rendered pixels');

  await radio('Signal').check();
  await expect(radio('Signal')).toBeChecked();
  await expect(radio('Chalk')).toBeChecked();
  await expect(radio('Solid')).toBeChecked();
  const signal = await settledCanvas();
  changed('buttonColor', chalk, signal, 0.001);
  result.checks.push('independent button color changes rendered pixels');

  await radio('Translucent').check();
  await expect(radio('Translucent')).toBeChecked();
  await expect(radio('Signal')).toBeChecked();
  await expect(radio('Chalk')).toBeChecked();
  const translucent = await settledCanvas();
  changed('translucentFinish', signal, translucent, 0.01);
  await capture('production-translucent.png');
  result.checks.push('translucent finish changes rendered pixels and preserves both colors');

  await button('Explode').click();
  await expect(button('Explode')).toHaveAttribute('aria-pressed', 'true');
  await expect(slider).toHaveValue('100');
  await expect(slider).toHaveAttribute('aria-valuetext', '100 percent exploded');
  const exploded = await settledCanvas();
  changed('explode', translucent, exploded, 0.02);
  await capture('production-exploded.png');

  await slider.press('Home');
  await expect(slider).toHaveValue('0');
  for (let i = 0; i < 5; i++) await slider.press('PageUp');
  await expect(slider).toHaveValue('50');
  await expect(slider).toHaveAttribute('aria-valuetext', '50 percent exploded');
  await expect(button('Explode')).toHaveAttribute('aria-pressed', 'false');
  changed('partialAssembly', exploded, await settledCanvas(), 0.01);
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await button('Assemble').click();
  await expect(slider).toHaveValue('0');
  await expect(slider).toHaveAttribute('aria-valuetext', '0 percent exploded');
  await expect(button('Studio')).toHaveAttribute('aria-pressed', 'true');
  await expect(radio('Signal')).toBeChecked();
  await expect(radio('Translucent')).toBeChecked();
  changed('assemble', exploded, await settledCanvas(), 0.02);
  result.checks.push('explode, keyboard assembly slider, and assemble preserve customization');

  await button('Back').click();
  await expect(button('Back')).toHaveAttribute('aria-pressed', 'true');
  changed('backView', translucent, await settledCanvas(), 0.02);
  await button('Studio').click();
  await button('Fit').click();
  const fitted = await settledCanvas();
  await button('Zoom in').click();
  await button('Zoom in').click();
  const zoomed = await settledCanvas();
  changed('zoomIn', fitted, zoomed, 0.01);
  await button('Zoom out').click();
  changed('zoomOut', zoomed, await settledCanvas(), 0.005);
  await button('Fit').click();
  const fitDifference = pixelDifference(fitted, await settledCanvas());
  result.imageDifferences.fitRestoration = fitDifference;
  expect(fitDifference, 'Fit should restore the fitted composition').toBeLessThan(0.005);
  result.checks.push('camera preset, zoom in/out, and Fit restore the composition');

  await button('Explode').click();
  await expect(slider).toHaveValue('100');
  await button('Reset build').click();
  await expect(radio('Chalk')).toBeChecked();
  await expect(radio('Charcoal')).toBeChecked();
  await expect(radio('Solid')).toBeChecked();
  await expect(slider).toHaveValue('0');
  await expect(button('Studio')).toHaveAttribute('aria-pressed', 'true');
  const resetDifference = pixelDifference(initial, await settledCanvas());
  result.imageDifferences.resetRestoration = resetDifference;
  expect(resetDifference, 'Reset should restore the original rendered build').toBeLessThan(0.005);
  await capture('production-desktop.png');
  result.checks.push('reset restores colors, finish, assembly, and camera');

  // Assert exclusion only; no smoke test reads the development diagnostics.
  expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
  result.checks.push('development diagnostics excluded');
  expect(result.pageErrors).toEqual([]);
  expect(result.consoleErrors).toEqual([]);
  expect(result.failedRequests).toEqual([]);
  expect(result.httpErrors).toEqual([]);
  result.checks.push('no page errors, console errors, failed requests, or HTTP errors');
  result.passed = true;
} catch (error) {
  failure = error;
  result.failure = error instanceof Error ? error.message : String(error);
  result.previewOutput = serverOutput;
  if (page && !page.isClosed()) {
    try {
      await page.screenshot({ path: fileURLToPath(new URL('production-failure.png', artifacts)), fullPage: true });
    } catch (screenshotError) {
      result.failureScreenshotError = String(screenshotError);
    }
  }
} finally {
  try {
    result.elapsedMs = Date.now() - started;
    await mkdir(artifacts, { recursive: true });
    await writeFile(new URL('production-smoke.json', artifacts), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try { await browser?.close(); } finally { server.kill(); }
  }
}
if (failure) throw failure;
