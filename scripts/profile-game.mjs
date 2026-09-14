import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'docs', 'screenshots', 'milestone-3');
const downloads = join(root, '.cache', 'downloads');
const runId = `${process.pid}-${Date.now()}`;
const url = process.env.STUDIO_PROFILE_URL ?? 'http://127.0.0.1:5173/';
const parsed = new URL(url);
assert(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Game profiling must target the local Handheld Studio preview.');
const report = {
  passed: false,
  testedAt: new Date().toISOString(),
  url,
  note: 'Installed Chrome headless on this Windows host. Pixel 7 uses viewport and touch emulation, not physical-phone hardware. Texture updates count CanvasTexture version increments from game redraws; viewer frames count the existing render callbacks. These measurements are not GPU execution time or guaranteed display frame rate. Run without other browser benchmarks for comparison.',
  contexts: {},
};
const failures = [];

function resources(snapshot) {
  return {
    calls: snapshot.calls,
    triangles: snapshot.triangles,
    geometries: snapshot.geometries,
    textures: snapshot.textures,
    programs: snapshot.programs,
    dpr: snapshot.dpr,
  };
}

async function snapshot(page) {
  return page.evaluate(() => globalThis.__HS_STUDIO__.snapshot());
}

async function settle(page) {
  const deadline = Date.now() + 15_000;
  let stable = 0;
  let previous = await snapshot(page);
  while (Date.now() < deadline) {
    await page.waitForTimeout(240);
    const next = await snapshot(page);
    stable = next.frames === previous.frames ? stable + 1 : 0;
    if (stable >= 2) return next;
    previous = next;
  }
  throw new Error('Viewer did not stop rendering within 15 seconds.');
}

// Both endpoints use the browser clock so Playwright transport overhead is not
// included in the requested measurement window.
async function timedWindow(page, milliseconds) {
  return page.evaluate(async duration => {
    const before = { time: performance.now(), snapshot: globalThis.__HS_STUDIO__.snapshot() };
    await new Promise(resolve => setTimeout(resolve, duration));
    const after = { time: performance.now(), snapshot: globalThis.__HS_STUDIO__.snapshot() };
    return { before, after, actualWallMs: after.time - before.time };
  }, milliseconds);
}

await Promise.all([mkdir(artifacts, { recursive: true }), mkdir(downloads, { recursive: true })]);
try {
  for (const [name, settings] of [
    ['desktop', { viewport: { width: 1440, height: 1000 } }],
    ['mobile', devices['Pixel 7']],
  ]) {
    let context;
    const started = Date.now();
    const result = { passed: false, testedAt: new Date().toISOString(), pageErrors: [], consoleErrors: [] };
    report.contexts[name] = result;
    try {
      context = await chromium.launchPersistentContext(join(root, '.cache', `game-performance-${name}-${runId}`), {
        channel: 'chrome', headless: true, downloadsPath: downloads, ...settings,
        reducedMotion: 'no-preference',
      });
      result.browser = context.browser()?.version() ?? 'Installed Chrome';
      const page = context.pages()[0] ?? await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on('pageerror', error => result.pageErrors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
      await page.goto(url, { waitUntil: 'networkidle' });
      await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
      await page.waitForFunction(() => globalThis.__HS_STUDIO__?.snapshot().calls > 0);
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const beforePlay = await settle(page);
      result.viewport = page.viewportSize();
      result.renderer = beforePlay.renderer;
      result.resources = { beforePlay: resources(beforePlay) };

      await page.getByRole('button', { name: 'Play Signal Run', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeEnabled();
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const playReady = await settle(page);
      assert.equal(playReady.game.phase, 'ready');
      result.resources.playReady = resources(playReady);
      await page.getByRole('button', { name: 'Start game', exact: true }).click();
      await expect(page.locator('.game-panel')).toHaveAttribute('data-phase', 'running');
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const active = await timedWindow(page, 2000);
      const first = active.before.snapshot;
      const last = active.after.snapshot;
      assert.equal(first.game.phase, 'running');
      assert.equal(last.game.phase, 'running', 'The two-second sample must end before the opening center hazard.');
      assert(last.game.elapsed < 5, 'The running sample must remain in the opening game window.');
      result.running = {
        requestedWallMs: 2000,
        actualWallMs: active.actualWallMs,
        simulationStartSeconds: first.game.elapsed,
        simulationEndSeconds: last.game.elapsed,
        simulationAdvancedSeconds: last.game.elapsed - first.game.elapsed,
        textureUpdates: last.game.textureVersion - first.game.textureVersion,
        viewerFrames: last.frames - first.frames,
        scoreAtEnd: last.game.score,
      };
      assert(result.running.textureUpdates > 0, 'Game textures must update while running.');
      assert(result.running.viewerFrames > 0, 'The viewer must render the running game.');
      result.resources.running = resources(last);

      await page.getByRole('button', { name: 'Pause game', exact: true }).click();
      await expect(page.locator('.game-panel')).toHaveAttribute('data-phase', 'paused');
      await settle(page);
      const paused = await timedWindow(page, 1000);
      result.paused = {
        requestedWallMs: 1000,
        actualWallMs: paused.actualWallMs,
        viewerFrames: paused.after.snapshot.frames - paused.before.snapshot.frames,
        textureUpdates: paused.after.snapshot.game.textureVersion - paused.before.snapshot.game.textureVersion,
        simulationAdvancedSeconds: paused.after.snapshot.game.elapsed - paused.before.snapshot.game.elapsed,
      };
      assert.equal(result.paused.viewerFrames, 0, 'Paused gameplay should render no extra viewer frames after settling.');
      assert.equal(result.paused.textureUpdates, 0, 'Paused gameplay should not redraw its texture.');
      assert.equal(result.paused.simulationAdvancedSeconds, 0, 'Paused gameplay should not advance the simulation.');

      await page.getByRole('button', { name: 'Exit Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Play Signal Run', exact: true })).toBeVisible();
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const afterExit = await settle(page);
      assert.equal(afterExit.game, undefined, 'Exiting Play must detach the game texture and diagnostics.');
      result.resources.afterExit = resources(afterExit);
      result.resources.exitDeltas = Object.fromEntries(['geometries', 'textures', 'programs'].map(key => [key, afterExit[key] - beforePlay[key]]));
      const exited = await timedWindow(page, 1000);
      result.exited = {
        requestedWallMs: 1000,
        actualWallMs: exited.actualWallMs,
        viewerFrames: exited.after.snapshot.frames - exited.before.snapshot.frames,
      };
      assert.equal(result.exited.viewerFrames, 0, 'The studio should render no extra frames at rest after Exit Play.');
      assert.deepEqual(result.pageErrors, []);
      assert.deepEqual(result.consoleErrors, []);
      result.passed = true;
    } catch (error) {
      result.failure = error instanceof Error ? error.message : String(error);
      failures.push(`${name}: ${result.failure}`);
    } finally {
      try { await context?.close(); } finally { result.elapsedMs = Date.now() - started; }
    }
    console.log(JSON.stringify({ context: name, ...result }, null, 2));
  }
  report.passed = failures.length === 0;
} finally {
  await writeFile(join(artifacts, 'game-performance.json'), JSON.stringify(report, null, 2));
}
if (failures.length) throw new Error(`Game performance verification failed:\n${failures.join('\n')}`);
