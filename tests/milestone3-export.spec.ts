import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

test.use({ launchOptions: { downloadsPath: resolve('.cache/downloads') } });

const directory = 'docs/screenshots/milestone-3';
const studio = (page: Page) => page.evaluate(() => window.__HS_STUDIO__!.snapshot());

async function settle(page: Page) {
  await expect(async () => {
    const before = await studio(page);
    await page.waitForTimeout(180);
    const after = await studio(page);
    expect(after.frames).toBe(before.frames);
    expect(after.camera).toEqual(before.camera);
  }).toPass({ timeout: 12000 });
}

async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeEnabled();
  await settle(page);
}

function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

function imageDifference(first: Buffer, second: Buffer) {
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  expect([b.width, b.height]).toEqual([a.width, a.height]);
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    if (Math.max(...[0, 1, 2].map(channel => Math.abs(a.data[index + channel] - b.data[index + channel]))) > 12) changed++;
  }
  return changed / (a.width * a.height);
}

function inspectPng(buffer: Buffer) {
  const png = PNG.sync.read(buffer);
  expect([png.width, png.height]).toEqual([1600, 1200]);
  const background = [...png.data.subarray(0, 3)];
  expect(background).toEqual([241, 238, 231]);
  let changed = 0, edgeChanged = 0, left = png.width, right = 0, top = png.height, bottom = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const index = (y * png.width + x) * 4;
    if (png.data[index + 3] !== 255) throw new Error(`PNG has non-opaque alpha at ${x},${y}`);
    const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(png.data[index + channel] - background[channel])));
    if (difference > 25) {
      changed++;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      if (x < 30 || x >= png.width - 30 || y < 30 || y >= png.height - 30) edgeChanged++;
    }
  }
  const coverage = changed / (png.width * png.height);
  expect(coverage).toBeGreaterThan(.1);
  expect(coverage).toBeLessThan(.72);
  expect(edgeChanged).toBe(0);
  expect(left).toBeGreaterThan(30); expect(right).toBeLessThan(png.width - 30);
  expect(top).toBeGreaterThan(30); expect(bottom).toBeLessThan(png.height - 30);
  return { width: png.width, height: png.height, background, opaque: true, coverage, bounds: { left, right, top, bottom } };
}

async function downloadPng(page: Page, filename: string, artifact: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  await expect(page.getByTestId('build-feedback')).toContainText('PNG ready');
  await expect(page.getByRole('link', { name: 'Download PNG', exact: true })).toBeVisible();
  await mkdir(directory, { recursive: true });
  const path = `${directory}/export-${artifact}.png`;
  await download.saveAs(path);
  const bytes = await readFile(path);
  const details = inspectPng(bytes);
  await writeFile(`${directory}/export-${artifact}.json`, JSON.stringify(details, null, 2));
  return bytes;
}

async function liveState(page: Page) {
  const current = await studio(page);
  return { camera: current.camera, zoom: current.zoom, assembly: current.assembly, materials: current.materials, game: current.game };
}

async function memoryAfterFrame(page: Page) {
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await settle(page);
  await page.getByRole('button', { name: 'Studio', exact: true }).click();
  await settle(page);
  return page.evaluate(() => {
    const state = window.__HS_STUDIO__!.snapshot();
    return { geometries: state.geometries, textures: state.textures, programs: state.programs };
  });
}

test('export: real opaque PNGs retain colors, material differences and clean framing', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors = observeErrors(page);
  await open(page);
  const chalk = await downloadPng(page, 'hs-01-chalk-solid-charcoal.png', `chalk-solid-${info.project.name}`);
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await page.getByRole('radio', { name: 'Signal', exact: true }).check();
  await settle(page);
  const ember = await downloadPng(page, 'hs-01-ember-solid-signal.png', `ember-solid-${info.project.name}`);
  expect(imageDifference(chalk, ember)).toBeGreaterThan(.04);
  await page.getByRole('radio', { name: 'Translucent', exact: true }).check();
  await settle(page);
  const translucent = await downloadPng(page, 'hs-01-ember-translucent-signal.png', `ember-translucent-${info.project.name}`);
  expect(imageDifference(ember, translucent)).toBeGreaterThan(.015);
  expect(errors).toEqual([]);
});

test('export: exploded capture is assembled, preserves the live build and releases repeated capture resources', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors = observeErrors(page);
  await open(page);
  await page.getByRole('radio', { name: 'Graphite', exact: true }).check();
  await page.getByRole('radio', { name: 'Ivory', exact: true }).check();
  await page.getByRole('radio', { name: 'Translucent', exact: true }).check();
  await settle(page);
  const filename = 'hs-01-graphite-translucent-ivory.png';
  const assembled = await downloadPng(page, filename, `assembled-${info.project.name}`);
  const beforeMemory = await memoryAfterFrame(page);
  await page.getByRole('button', { name: 'Explode', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await settle(page);
  const before = await liveState(page);
  expect(before.assembly.progress).toBe(1);
  for (let repetition = 0; repetition < 3; repetition++) {
    const exported = await downloadPng(page, filename, `exploded-${repetition}-${info.project.name}`);
    expect(imageDifference(assembled, exported)).toBeLessThan(.003);
    await settle(page);
    expect(await liveState(page)).toEqual(before);
    await expect(page.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Ivory', exact: true })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Translucent', exact: true })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await settle(page);
  const afterMemory = await memoryAfterFrame(page);
  expect(afterMemory.geometries).toBeLessThanOrEqual(beforeMemory.geometries);
  expect(afterMemory.textures).toBeLessThanOrEqual(beforeMemory.textures);
  expect(afterMemory.programs).toBeLessThanOrEqual(beforeMemory.programs + 1);
  await writeFile(`${directory}/export-memory-${info.project.name}.json`, JSON.stringify({ before: beforeMemory, after: afterMemory, additionalExports: 3 }, null, 2));
  expect(errors).toEqual([]);
});

test('export: paused play keeps its game and camera while the PNG uses the normal boot screen', async ({ page }, info) => {
  test.setTimeout(90000);
  const errors = observeErrors(page);
  await open(page);
  const normal = await downloadPng(page, 'hs-01-chalk-solid-charcoal.png', `normal-boot-${info.project.name}`);
  await page.getByRole('button', { name: 'Play Signal Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase', 'paused');
  await settle(page);
  const before = await liveState(page);
  expect(before.game?.phase).toBe('paused');
  const paused = await downloadPng(page, 'hs-01-chalk-solid-charcoal.png', `paused-game-${info.project.name}`);
  expect(imageDifference(normal, paused)).toBeLessThan(.003);
  await settle(page);
  expect(await liveState(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Resume game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Exit Play', exact: true }).click();
  await settle(page);
  await expect(page.getByRole('button', { name: 'Play Signal Run', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('export: unavailable WebGL disables capture without suggesting a download exists', async ({ page }) => {
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, options?: unknown) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, options]);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByText('3D view unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: 'Ember', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Download PNG', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('build-feedback')).not.toContainText('PNG ready');
  expect(downloads).toEqual([]);
});

test('export: an actively running game continues after capturing its configured device', async ({ page }, info) => {
  const errors = observeErrors(page);
  await open(page);
  await page.getByRole('button', { name: 'Play Signal Run', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  // Dodge the opening center hazard so GPU capture latency cannot end the run.
  await page.getByRole('button', { name: 'Move right', exact: true }).click();
  const before = await studio(page);
  await downloadPng(page, 'hs-01-chalk-solid-charcoal.png', `running-game-${info.project.name}`);
  await expect(page.locator('.game-panel')).toHaveAttribute('data-phase', 'running');
  const after = await studio(page);
  expect(after.camera).toEqual(before.camera);
  expect(after.game!.lane).toBe(2);
  await expect.poll(async () => (await studio(page)).game!.elapsed).toBeGreaterThan(before.game!.elapsed);
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  await settle(page);
  await page.getByRole('button', { name: 'Exit Play', exact: true }).click();
  await settle(page);
  expect(errors).toEqual([]);
});
