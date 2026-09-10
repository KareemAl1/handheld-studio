import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

function pixelDifference(a: Buffer, b: Buffer) {
  const first = PNG.sync.read(a);
  const second = PNG.sync.read(b);
  expect([second.width, second.height]).toEqual([first.width, first.height]);
  let changed = 0;
  for (let i = 0; i < first.data.length; i += 4) {
    if (Math.max(...[0, 1, 2].map((channel) => Math.abs(first.data[i + channel] - second.data[i + channel]))) > 18) changed++;
  }
  return changed / (first.width * first.height);
}

async function openStudio(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await settle(page);
}

async function settle(page: Page) {
  await expect(async () => {
    const before = await page.evaluate(() => window.__HS_STUDIO__?.snapshot());
    expect(before).toBeDefined();
    await page.waitForTimeout(220);
    const after = await page.evaluate(() => window.__HS_STUDIO__?.snapshot());
    expect(after?.camera).toEqual(before?.camera);
    expect(after?.frames).toBe(before?.frames);
  }).toPass({ timeout: 12_000, intervals: [250, 500] });
}

async function tabTo(page: Page, locator: Locator) {
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('Control could not be reached using Tab');
}

test('shell changes the rendered device after idle and reset restores it', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openStudio(page);
  const canvas = page.locator('canvas');
  const chalk = await canvas.screenshot();
  const ember = page.getByRole('radio', { name: 'Ember', exact: true });
  if (isMobile) await ember.tap(); else await ember.check();
  await expect(ember).toBeChecked();
  await settle(page);
  expect(pixelDifference(await canvas.screenshot(), chalk)).toBeGreaterThan(0.08);
  await page.getByRole('button', { name: 'Reset build' }).click();
  await expect(page.getByRole('radio', { name: 'Chalk', exact: true })).toBeChecked();
  await settle(page);
  // Fractional mobile device pixels can shift antialiased edges by one pixel.
  expect(pixelDifference(await canvas.screenshot(), chalk)).toBeLessThan(0.012);
  expect(errors).toEqual([]);
});

test('front, back and reset inspect the actual camera and retain the selected shell', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('radio', { name: 'Graphite', exact: true }).check();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera))[2]).toBeLessThan(0);
  await expect(page.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await settle(page);
  const front = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  expect(front[2]).toBeGreaterThan(0);
  expect(Math.abs(front[0])).toBeLessThan(0.001);
  await page.getByRole('button', { name: 'Reset build' }).click();
  await settle(page);
  expect((await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera))[0]).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: 'Studio', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('mouse drag changes the camera and comes to rest', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch gesture is verified separately.');
  await openStudio(page);
  const before = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.58, { steps: 20 });
  await page.mouse.up();
  await settle(page);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera)).not.toEqual(before);
  await expect(page.getByRole('button', { name: 'Studio', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('front-to-back transition stays outside the device after an idle period', async ({ page }) => {
  await openStudio(page);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await settle(page);
  await page.waitForTimeout(900);
  const radius = await page.evaluate(() => Math.hypot(...window.__HS_STUDIO__!.snapshot().camera));
  const trajectory = page.evaluate(() => new Promise<number[][]>((resolve) => {
    const samples: number[][] = [];
    const start = performance.now();
    function sample() {
      samples.push(window.__HS_STUDIO__!.snapshot().camera);
      if (performance.now() - start > 1200) resolve(samples);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const positions = await trajectory;
  expect(Math.min(...positions.map((position) => Math.hypot(...position)))).toBeGreaterThan(radius * 0.98);
  expect(positions.filter((position) => Math.abs(position[2]) < radius * 0.7).length).toBeGreaterThan(3);
  await settle(page);
});

test('keyboard reaches shell options and camera controls with visible focus', async ({ page }) => {
  await openStudio(page);
  const front = page.getByRole('button', { name: 'Front', exact: true });
  await tabTo(page, front);
  await expect(front).toBeFocused();
  expect(await front.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await settle(page);
  await expect(front).toHaveAttribute('aria-pressed', 'true');
  await tabTo(page, page.getByRole('radio', { name: 'Chalk', exact: true }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Ember', exact: true })).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: 'Reset build' }));
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Chalk', exact: true })).toBeChecked();
});

test('touch rotates the device and the surrounding page can still scroll', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Real emulated touch input is tested in the mobile context.');
  await openStudio(page);
  const before = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  const box = (await page.locator('canvas').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width * 0.3;
  const y = box.y + box.height * 0.5;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 9, y: y + i * 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera)).not.toEqual(before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: 650 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 8, y: 650 - i * 35 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(30);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion skips camera tweening and remains idle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStudio(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const back = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().camera);
  expect(back[2]).toBeLessThan(0);
  expect(Math.abs(back[0])).toBeLessThan(0.001);
  await settle(page);
  const start = await page.evaluate(() => window.__HS_STUDIO__!.snapshot().frames);
  await page.waitForTimeout(650);
  expect(await page.evaluate(() => window.__HS_STUDIO__!.snapshot().frames)).toBe(start);
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Ember', exact: true })).toBeChecked();
});

test('unavailable WebGL shows a useful poster and working configuration controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, id: string, options?: object) {
        return id.includes('webgl') ? null : Reflect.apply(original, this, [id, options]);
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText('3D view unavailable', { exact: true })).toBeVisible();
  const poster = page.getByRole('img', { name: 'HS–01 handheld in its default Chalk shell' });
  expect(await poster.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Ember', exact: true })).toBeChecked();
  await expect(page.getByText('Preparing your handheld…')).toHaveCount(0);
});

test('failed model load can retry without losing the chosen shell', async ({ page }) => {
  await page.route('**/models/hs-01.glb', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('The device couldn’t load', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await page.unroute('**/models/hs-01.glb');
  await page.getByRole('button', { name: 'Retry 3D view' }).click();
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('radio', { name: 'Ember', exact: true })).toBeChecked();
  await settle(page);
});

test('failed scene module offers a working page reload', async ({ page }) => {
  await page.route('**/src/scene/StudioScene.tsx*', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('The viewer couldn’t load', { exact: true })).toBeVisible();
  await page.unroute('**/src/scene/StudioScene.tsx*');
  await page.getByRole('button', { name: 'Reload page' }).click();
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await settle(page);
});

test('controls remain fully inside their panels at narrow widths and 200 percent text', async ({ page, isMobile }) => {
  test.skip(isMobile, 'This responsive matrix runs once in the desktop browser context.');
  await openStudio(page);
  for (const width of [320, 768, 1024, 1440]) {
    for (const textSize of [16, 32]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, textSize);
      await settle(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow at ${width}px / ${textSize}px text`).toBe(true);
      for (const [panel, selector] of [['.configurator', 'input,button'], ['.viewer-toolbar', 'button']]) {
        const bounds = (await page.locator(panel).boundingBox())!;
        for (const control of await page.locator(`${panel} ${selector.split(',').join(`,${panel} `)}`).all()) {
          const rect = (await control.boundingBox())!;
          expect(rect.x, `left clip at ${width}px / ${textSize}px text`).toBeGreaterThanOrEqual(bounds.x);
          expect(rect.x + rect.width, `right clip at ${width}px / ${textSize}px text`).toBeLessThanOrEqual(bounds.x + bounds.width + 0.5);
          expect(rect.y + rect.height, `bottom clip at ${width}px / ${textSize}px text`).toBeLessThanOrEqual(bounds.y + bounds.height + 0.5);
        }
      }
      if (width === 320 && textSize === 32) await page.screenshot({ path: 'docs/screenshots/narrow-200-percent-text.png', fullPage: true });
    }
  }
});

test('capture reviewed layouts and measured active rendering', async ({ page }, testInfo) => {
  await openStudio(page);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-chalk.png`, fullPage: true });
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-ember.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `docs/screenshots/${testInfo.project.name}-back.png`, fullPage: true });
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await settle(page);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.evaluate(() => window.__HS_STUDIO__!.beginMeasure());
  for (let i = 0; i < 90; i++) {
    await page.mouse.move(box.x + box.width * 0.45 + Math.sin(i / 15) * 90, box.y + box.height * 0.5 + Math.cos(i / 20) * 20);
    await page.waitForTimeout(16);
  }
  const intervals = await page.evaluate(() => window.__HS_STUDIO__!.endMeasure());
  await page.mouse.up();
  await settle(page);
  const snapshot = await page.evaluate(() => window.__HS_STUDIO__!.snapshot());
  const start = snapshot.frames;
  await page.waitForTimeout(1000);
  const idleFrames = (await page.evaluate(() => window.__HS_STUDIO__!.snapshot().frames)) - start;
  const sorted = [...intervals].sort((a, b) => a - b);
  const report = {
    viewport: page.viewportSize(), browser: page.context().browser()!.version(),
    ...snapshot, idleFramesOverOneSecond: idleFrames, activeSamples: intervals.length,
    activeFrameIntervalMedianMs: sorted[Math.floor(sorted.length * 0.5)],
    activeFrameIntervalP95Ms: sorted[Math.floor(sorted.length * 0.95)],
    activeFrameIntervalMeanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
    note: 'Development build, scripted mouse orbit, installed Chrome headless on this host. Intervals measure render cadence, not GPU execution time. Mobile is viewport/touch emulation, not physical-device GPU performance.',
  };
  await writeFile(`docs/screenshots/${testInfo.project.name}-performance.json`, JSON.stringify(report, null, 2));
  expect(idleFrames).toBe(0);
});
