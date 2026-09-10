import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Production preview did not start')), 15_000);
    server.stdout.on('data', (data) => {
      if (String(data).includes('127.0.0.1:4173')) { clearTimeout(timer); resolve(); }
    });
    server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Preview exited: ${code}`)); });
    server.once('error', reject);
  });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('radio', { name: 'Chalk', exact: true })).toBeChecked();
  await page.waitForTimeout(400);
  await mkdir(new URL('../docs/screenshots/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../docs/screenshots/production-desktop.png', import.meta.url)), fullPage: true });
  const chalk = await page.locator('canvas').screenshot();
  await page.getByRole('radio', { name: 'Graphite', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked();
  await page.waitForTimeout(250);
  expect((await page.locator('canvas').screenshot()).equals(chalk)).toBe(false);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Reset build' }).click();
  await expect(page.getByRole('radio', { name: 'Chalk', exact: true })).toBeChecked();
  expect(await page.evaluate(() => '__HS_STUDIO__' in globalThis)).toBe(false);
  expect(errors).toEqual([]);
  const result = { passed: true, browser: browser.version(), consoleErrors: errors, checks: ['production module loading', 'actual rendered shell change', 'camera control', 'reset', 'development diagnostics excluded'] };
  await writeFile(new URL('../docs/screenshots/production-smoke.json', import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
