import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, expect } from '@playwright/test';
import { PNG } from 'pngjs';

// Run only against an explicitly supplied deployed site. No server, account,
// repository, or deployment mutation is performed by this verifier.
if (!process.env.HS_LIVE_URL) throw new Error('Set HS_LIVE_URL to the verified public HTTPS deployment URL.');
const supplied = new URL(process.env.HS_LIVE_URL);
if (supplied.protocol !== 'https:' || supplied.username || supplied.password || supplied.search || supplied.hash || supplied.pathname !== '/') {
  throw new Error('HS_LIVE_URL must be a public HTTPS origin without credentials, path, query, or fragment.');
}
if (['localhost', '127.0.0.1', '[::1]'].includes(supplied.hostname)) throw new Error('Use the public deployment, not a local preview.');
const origin = supplied.origin;
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'docs', 'screenshots', 'live');
const downloads = join(root, '.cache', 'downloads');
const savedKey = 'handheld-studio.saved-build';
const saved = { version: 2, shell: 'ember', buttons: 'ivory', finish: 'translucent' };
const defaults = { version: 2, shell: 'chalk', buttons: 'charcoal', finish: 'solid' };
const started = Date.now();
const report = {
  passed: false, testedAt: new Date().toISOString(), origin,
  limitations: ['Pixel 7 is Chrome mobile emulation, not a physical device.', 'Reduced motion is enabled to compare settled model pixels.', 'This live smoke test does not simulate hidden-tab boundaries or measure frame rates.'],
  contexts: [],
};

function pixelDifference(firstBuffer, secondBuffer) {
  const first = PNG.sync.read(firstBuffer), second = PNG.sync.read(secondBuffer);
  expect([second.width, second.height], 'Compare settled canvases with matching dimensions').toEqual([first.width, first.height]);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if (Math.max(...[0, 1, 2].map(channel => Math.abs(first.data[i + channel] - second.data[i + channel]))) > 18) changed += 1;
  }
  return changed / (first.width * first.height);
}

function inspectExport(buffer) {
  const png = PNG.sync.read(buffer);
  const background = [...png.data.subarray(0, 3)];
  let nonBackground = 0, transparent = 0, edgeChanged = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] !== 255) transparent += 1;
    const changed = Math.max(...[0, 1, 2].map(channel => Math.abs(png.data[i + channel] - background[channel]))) > 20;
    if (changed) {
      nonBackground += 1;
      const x = (i / 4) % png.width, y = Math.floor(i / 4 / png.width);
      if (x < 30 || x >= png.width - 30 || y < 30 || y >= png.height - 30) edgeChanged += 1;
    }
  }
  return { width: png.width, height: png.height, bytes: buffer.length, background, transparentPixels: transparent, edgeChangedPixels: edgeChanged, nonBackgroundFraction: nonBackground / (png.width * png.height) };
}

async function verifyContext(name, deviceOptions) {
  const result = {
    name, passed: false, browser: null, checks: [], imageDifferences: {},
    moduleResponses: [], modelResponses: [], pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [],
  };
  report.contexts.push(result);
  const profile = join(root, '.cache', `live-${name}-chrome-${process.pid}-${Date.now()}`);
  let context, page;
  try {
    // Each persistent profile is fresh and project-local. This closes only the
    // browser we own and keeps test saves/cookies away from personal Chrome.
    context = await chromium.launchPersistentContext(profile, {
      ...deviceOptions, channel: 'chrome', headless: true,
      downloadsPath: downloads, acceptDownloads: true, reducedMotion: 'reduce',
    });
    result.browser = context.browser()?.version() ?? 'Installed Chrome';
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
      result.clipboardPermissions = 'granted';
    } catch (error) {
      result.clipboardPermissions = `unavailable: ${error.message}`;
    }
    page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(25_000);
    page.on('pageerror', error => result.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText ?? 'Unknown failure' }));
    page.on('response', response => {
      const entry = { url: response.url(), status: response.status(), contentType: response.headers()['content-type'] ?? '' };
      if (response.status() >= 400) result.httpErrors.push(entry);
      if (new URL(entry.url).pathname.endsWith('.js')) result.moduleResponses.push(entry);
      if (new URL(entry.url).pathname.endsWith('.glb')) result.modelResponses.push(entry);
    });
    const button = buttonName => page.getByRole('button', { name: buttonName, exact: true });
    const radio = radioName => page.getByRole('radio', { name: radioName, exact: true });
    const canvas = page.locator('canvas');
    const panel = page.locator('.game-panel');
    const feedback = page.getByTestId('build-feedback');
    const activate = locator => name === 'mobile' ? locator.tap() : locator.click();
    async function loaded() {
      await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
      expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
      expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    }
    async function selected(labels = ['Ember', 'Translucent', 'Ivory']) {
      for (const label of labels) await expect(radio(label)).toBeChecked();
    }
    async function settledCanvas() {
      await canvas.scrollIntoViewIfNeeded();
      let previous = await canvas.screenshot({ animations: 'disabled' });
      let stable = 0;
      await expect.poll(async () => {
        const next = await canvas.screenshot({ animations: 'disabled' });
        const a = PNG.sync.read(previous), b = PNG.sync.read(next);
        // Play and responsive scrolling resize the viewer. A resized sample is
        // unsettled, never a product failure or a valid pixel comparison.
        stable = a.width === b.width && a.height === b.height && pixelDifference(previous, next) < 0.0001 ? stable + 1 : 0;
        previous = next;
        return stable;
      }, { timeout: 15_000, intervals: [100, 150, 250] }).toBeGreaterThanOrEqual(2);
      return previous;
    }
    async function navigate(url) {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      expect(response?.status(), `Public page ${url}`).toBe(200);
      expect(new URL(page.url()).origin).toBe(origin);
      await loaded();
    }

    await navigate(origin);
    await selected(['Chalk', 'Solid', 'Charcoal']);
    const initial = await settledCanvas();
    expect(result.moduleResponses.some(item => item.status === 200 && item.contentType.includes('javascript'))).toBe(true);
    expect(result.modelResponses.some(item => item.status === 200 && new URL(item.url).pathname === '/models/hs-01.glb')).toBe(true);
    for (const shell of ['Graphite', 'Ember']) {
      await radio(shell).check();
      const difference = pixelDifference(initial, await settledCanvas());
      result.imageDifferences[shell] = difference;
      expect(difference, `${shell} must change the actual model pixels`).toBeGreaterThan(0.02);
    }
    await radio('Chalk').check();
    await settledCanvas();
    result.checks.push('HTTPS document, hashed JavaScript modules, and original GLB return 200; actual model pixels respond to all three shell colors; no development diagnostics or horizontal overflow');

    await activate(button('Explode'));
    await activate(button('Play Signal Run'));
    await expect(button('Start game')).toBeEnabled();
    await expect(button('Exit Play')).toBeVisible();
    const ready = await settledCanvas();
    if (name === 'desktop') { await canvas.focus(); await page.keyboard.press('Enter'); }
    else await activate(button('Start game'));
    await expect(panel).toHaveAttribute('data-phase', 'running');
    await expect(page.getByTestId('game-score')).toHaveText('10', { timeout: 12_000 });
    result.imageDifferences.gameScreen = pixelDifference(ready, await canvas.screenshot({ animations: 'disabled' }));
    expect(result.imageDifferences.gameScreen).toBeGreaterThan(0.01);
    await page.screenshot({ path: join(artifacts, `game-${name}.png`), fullPage: true, animations: 'disabled' });
    await expect(panel).toHaveAttribute('data-phase', 'over', { timeout: 12_000 });
    await activate(button('Restart game'));
    await expect(panel).toHaveAttribute('data-phase', 'running');
    await expect(page.getByTestId('game-score')).toHaveText('0');
    if (name === 'mobile') await activate(button('Move left'));
    else await page.keyboard.press('ArrowLeft');
    await expect(panel).toHaveAttribute('data-lane', '0');
    if (name === 'mobile') { await activate(button('Move right')); await activate(button('Move right')); }
    else { await page.keyboard.press('d'); await page.keyboard.press('ArrowRight'); }
    await expect(panel).toHaveAttribute('data-lane', '2');
    await activate(button('Pause game'));
    await expect(panel).toHaveAttribute('data-phase', 'paused');
    const paused = await settledCanvas();
    await page.waitForTimeout(700);
    expect(pixelDifference(paused, await canvas.screenshot({ animations: 'disabled' }))).toBeLessThan(0.0001);
    await activate(button('Resume game'));
    await expect(panel).toHaveAttribute('data-phase', 'running');
    await activate(button('Exit Play'));
    if (name === 'desktop') await expect(button('Play Signal Run')).toBeFocused();
    await expect(page.getByRole('slider', { name: 'Assembly', exact: true })).toHaveValue('0');
    result.checks.push(`Actual device screen completes start, score 10, game over, restart, ${name === 'mobile' ? 'touch' : 'keyboard'} lane changes, pause/resume, and Exit; Play assembles the device`);

    for (const label of ['Ember', 'Translucent', 'Ivory']) await radio(label).check();
    await selected();
    const configured = await settledCanvas();
    await activate(button('Save build'));
    await expect(feedback).toHaveText('Build saved in this browser.');
    expect(await page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), savedKey)).toEqual(saved);
    await page.reload({ waitUntil: 'networkidle' });
    await loaded(); await selected();
    await expect(feedback).toContainText('Your saved build was restored.');
    result.imageDifferences.reload = pixelDifference(configured, await settledCanvas());
    expect(result.imageDifferences.reload).toBeLessThan(0.005);
    await radio('Chalk').check();
    await activate(button('Restore saved'));
    await selected();
    await expect(feedback).toHaveText('Saved build restored.');
    result.checks.push('Save, reload, and explicit Restore preserve shell, finish, and buttons, including rendered pixels');

    await activate(button('Copy share link'));
    const shareInput = page.getByRole('textbox', { name: 'Share link', exact: true });
    await expect(shareInput).toHaveValue(`${origin}/?v=2&s=ember&b=ivory&f=translucent`);
    const link = await shareInput.inputValue();
    await expect(feedback).toHaveText(/^(Share link copied\.|Clipboard unavailable\. Select and copy the link below\.)$/);
    if ((await feedback.textContent()) === 'Share link copied.') {
      try {
        expect(await page.evaluate(() => globalThis.navigator.clipboard.readText())).toBe(link);
        result.clipboard = 'Native browser clipboard write and read verified with granted permissions; no mock';
      } catch (error) {
        // Do not conceal an incorrect copied value. A browser read denial can
        // still leave the native write and visible selectable link usable.
        if (!String(error).includes('NotAllowedError') && !String(error).includes('denied')) throw error;
        result.clipboard = `Native write reported success; read denied, selectable URL verified: ${error.message}`;
      }
    } else {
      result.clipboard = 'Native browser clipboard unavailable; actual selectable-link fallback verified without mocking';
      await expect(shareInput).toBeFocused();
      expect(await shareInput.evaluate(input => input.selectionEnd - input.selectionStart)).toBe(link.length);
    }
    await expect(page.getByText('Share links open this build on this site. Saved builds stay in this browser.', { exact: true })).toBeVisible();
    result.shareLink = link;
    await activate(button('Reset build'));
    await activate(button('Save build'));
    await expect(feedback).toHaveText('Build saved in this browser.');
    await navigate(link); await selected();
    await expect(feedback).toContainText('Shared build loaded.');
    expect(await page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), savedKey)).toEqual(defaults);
    result.imageDifferences.shared = pixelDifference(configured, await settledCanvas());
    expect(result.imageDifferences.shared).toBeLessThan(0.005);
    await navigate(`${origin}/?v=2&s=ember&b=ivory&f=translucent&s=chalk`);
    await selected(['Chalk', 'Solid', 'Charcoal']);
    await expect(feedback).toContainText('This share link is invalid or unsupported. Your saved build was restored.');
    await navigate(`${origin}/?v=999&s=ember&b=ivory&f=translucent`);
    await selected(['Chalk', 'Solid', 'Charcoal']);
    await expect(feedback).toContainText('This share link is invalid or unsupported.');
    result.checks.push('Version-2 public share link round-trips all choices without overwriting a distinct saved build; duplicate fields and unsupported URL versions safely fall back');

    await navigate(link); await selected(); await settledCanvas();
    await expect(button('Export PNG')).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), activate(button('Export PNG'))]);
    expect(download.suggestedFilename()).toBe('hs-01-ember-translucent-ivory.png');
    expect(await download.failure()).toBeNull();
    const exportedPath = join(artifacts, `export-${name}.png`);
    await download.saveAs(exportedPath);
    result.export = inspectExport(await readFile(exportedPath));
    expect([result.export.width, result.export.height]).toEqual([1600, 1200]);
    expect(result.export.background).toEqual([241, 238, 231]);
    expect(result.export.transparentPixels).toBe(0);
    expect(result.export.edgeChangedPixels).toBe(0);
    expect(result.export.nonBackgroundFraction).toBeGreaterThan(0.05);
    expect(result.export.nonBackgroundFraction).toBeLessThan(0.85);
    await expect(feedback).toContainText('PNG ready.');
    await expect(page.getByRole('link', { name: 'Download PNG', exact: true })).toBeVisible();
    await selected();
    result.checks.push('Actual PNG download decodes to opaque 1600×1200 with warm ivory background, visible configured device, and clear 30px edges');
    await page.evaluate(() => globalThis.scrollTo(0, 0));
    await page.screenshot({ path: join(artifacts, `site-${name}.png`), fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
    expect(result.pageErrors).toEqual([]); expect(result.consoleErrors).toEqual([]);
    expect(result.failedRequests).toEqual([]); expect(result.httpErrors).toEqual([]);
    result.checks.push('No page errors, console errors, failed network requests, or HTTP errors during the live workflow');
    result.passed = true;
  } catch (error) {
    result.failure = error instanceof Error ? error.message : String(error);
    if (page && !page.isClosed()) {
      try { await page.screenshot({ path: join(artifacts, `failure-${name}.png`), fullPage: true }); }
      catch (screenshotError) { result.failureScreenshotError = String(screenshotError); }
    }
  } finally {
    await context?.close();
  }
  console.log(`${name}: ${result.passed ? 'passed' : `FAILED: ${result.failure}`}`);
}

await Promise.all([mkdir(artifacts, { recursive: true }), mkdir(downloads, { recursive: true })]);
try {
  await verifyContext('desktop', { viewport: { width: 1440, height: 1000 } });
  await verifyContext('mobile', devices['Pixel 7']);
  report.passed = report.contexts.length === 2 && report.contexts.every(result => result.passed);
} finally {
  report.elapsedMs = Date.now() - started;
  await writeFile(join(artifacts, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
if (!report.passed) process.exitCode = 1;
