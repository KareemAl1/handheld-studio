import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_CONFIG, serializeConfig } from '../src/config/config';
import type { Configuration } from '../src/config/config';
import { SAVED_BUILD_KEY } from '../src/config/persistence';

const saved: Configuration = { version: 2, shell: 'graphite', buttons: 'ivory', finish: 'translucent' };
const shared: Configuration = { version: 2, shell: 'ember', buttons: 'signal', finish: 'solid' };
const labels = {
  chalk: 'Chalk', graphite: 'Graphite', ember: 'Ember',
  charcoal: 'Charcoal', ivory: 'Ivory', signal: 'Signal',
  solid: 'Solid', translucent: 'Translucent',
};
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
}

async function choose(page: Page, config: Configuration) {
  for (const id of [config.shell, config.buttons, config.finish]) {
    await page.getByRole('radio', { name: labels[id], exact: true }).check();
  }
}

async function expectBuild(page: Page, config: Configuration) {
  for (const id of [config.shell, config.buttons, config.finish]) {
    await expect(page.getByRole('radio', { name: labels[id], exact: true })).toBeChecked();
  }
  // Check the screen's live scene too, so restored controls cannot pass while
  // the renderer silently retains materials from the preceding build.
  await expect.poll(() => page.evaluate(() => window.__HS_STUDIO__!.snapshot().materials.buttons)).toBe({ charcoal: '333b37', ivory: 'ddd6c5', signal: 'cf532f' }[config.buttons]);
  await expect.poll(() => page.evaluate(() => window.__HS_STUDIO__!.snapshot().materials.transmission)).toBe(config.finish === 'solid' ? 0 : .76);
  if (config.finish === 'solid') {
    await expect.poll(() => page.evaluate(() => window.__HS_STUDIO__!.snapshot().materials.shell)).toBe({ chalk: 'dad5c8', graphite: '363d3b', ember: 'cf532f' }[config.shell]);
  }
}

async function stored(page: Page) {
  return page.evaluate(key => {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  }, SAVED_BUILD_KEY);
}

async function mockClipboard(page: Page, deny = false) {
  await page.addInitScript(({ deny }) => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(text: string) {
          if (deny) throw new DOMException('Clipboard blocked for this test', 'NotAllowedError');
          Object.defineProperty(window, '__HS_COPIED_LINK__', { configurable: true, value: text });
        },
      },
    });
  }, { deny });
}

test('build persistence: save, change, restore and reload preserve all three configuration choices', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('unrelated-preference', 'keep'));
  await choose(page, saved);
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toHaveText('Build saved in this browser.');
  expect(await stored(page)).toEqual(saved);
  await choose(page, shared);
  await expectBuild(page, shared);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toHaveText('Saved build restored.');
  await expectBuild(page, saved);
  await page.reload();
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expectBuild(page, saved);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-preference'))).toBe('keep');
});

test('build persistence: opening a share leaves the saved build intact and explicit restore clears the old query', async ({ page }) => {
  await open(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVED_BUILD_KEY, value: saved });
  await open(page, `/?${serializeConfig(shared)}`);
  await expectBuild(page, shared);
  await expect(page.getByTestId('build-feedback')).toContainText('Shared build loaded.');
  expect(await stored(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expectBuild(page, saved);
  expect(new URL(page.url()).search).toBe('');
  await page.reload();
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expectBuild(page, saved);
});

test('build persistence: explicitly saving an edited shared build removes stale URL state before reload', async ({ page }) => {
  await open(page, `/?${serializeConfig(shared)}`);
  await choose(page, saved);
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toHaveText('Build saved in this browser.');
  expect(new URL(page.url()).search).toBe('');
  expect(await stored(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByTestId('device-viewer')).toHaveAttribute('data-ready', 'true');
  await expectBuild(page, saved);
});

test('share links: copied text is a versioned round trip and explicitly describes the localhost limitation', async ({ page }) => {
  await mockClipboard(page);
  await open(page);
  const config: Configuration = { version: 2, shell: 'ember', buttons: 'ivory', finish: 'translucent' };
  await choose(page, config);
  await page.getByRole('button', { name: 'Copy share link', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toHaveText('Share link copied.');
  const link = await page.evaluate(() => (window as unknown as { __HS_COPIED_LINK__: string }).__HS_COPIED_LINK__);
  expect(link).toBeTruthy();
  const url = new URL(link);
  expect(url.origin).toBe(new URL(page.url()).origin);
  expect(url.pathname).toBe('/');
  expect(url.hash).toBe('');
  expect([...url.searchParams]).toEqual([['v', '2'], ['s', 'ember'], ['b', 'ivory'], ['f', 'translucent']]);
  await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toHaveValue(link);
  await expect(page.getByRole('textbox', { name: 'Share link', exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByText('Localhost links only work locally until deployment.', { exact: true })).toBeVisible();
  expect(await stored(page)).toBeNull();
  await open(page, link);
  await expectBuild(page, config);
  await expect(page.getByTestId('build-feedback')).toContainText('Shared build loaded.');
  expect(await stored(page)).toBeNull();
});

test('share links: representative solid and translucent URLs restore the actual device materials', async ({ page }) => {
  const configurations: Configuration[] = [
    { version: 2, shell: 'chalk', buttons: 'signal', finish: 'translucent' },
    { version: 2, shell: 'graphite', buttons: 'charcoal', finish: 'solid' },
    { version: 2, shell: 'ember', buttons: 'ivory', finish: 'solid' },
  ];
  for (const config of configurations) {
    await open(page, `/?${serializeConfig(config)}#detail-views`);
    await expectBuild(page, config);
    await expect(page.getByTestId('build-feedback')).toContainText('Shared build loaded.');
    expect(await stored(page)).toBeNull();
  }
});

test('share links: duplicate, unknown and missing fields fall back to saved data; absent saves use defaults', async ({ page }) => {
  await open(page);
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVED_BUILD_KEY, value: saved });
  for (const query of [
    'v=2&s=ember&b=signal&f=solid&b=ivory',
    'v=2&s=ember&b=signal&f=solid&unknown=1',
    'v=2&s=ember&b=signal',
  ]) {
    await open(page, `/?${query}`);
    await expect(page.getByTestId('build-feedback')).toContainText('share link is invalid');
    await expectBuild(page, saved);
    expect(await stored(page)).toEqual(saved);
  }
  await page.evaluate(key => localStorage.removeItem(key), SAVED_BUILD_KEY);
  await open(page, '/?v=99&s=graphite&b=ivory&f=solid');
  await expect(page.getByTestId('build-feedback')).toContainText('share link is invalid');
  await expectBuild(page, DEFAULT_CONFIG);
  expect(await stored(page)).toBeNull();
});

test('build persistence: a denied localStorage getter leaves customization and feedback usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage blocked for this test', 'SecurityError'); },
    });
  });
  await open(page);
  await expect(page.getByTestId('build-feedback')).toContainText('Local storage is unavailable');
  await choose(page, shared);
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toContainText('could not be saved');
  await expectBuild(page, shared);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toContainText('Local storage is unavailable');
  await expectBuild(page, shared);
});

test('build persistence: quota failure preserves the prior saved build and reports that the save failed', async ({ page }) => {
  await page.addInitScript(({ key, config }) => {
    localStorage.setItem(key, JSON.stringify(config));
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (storageKey: string, value: string) {
      if (storageKey === key) throw new DOMException('Storage full for this test', 'QuotaExceededError');
      setItem.call(this, storageKey, value);
    };
  }, { key: SAVED_BUILD_KEY, config: saved });
  await open(page);
  await expectBuild(page, saved);
  await choose(page, shared);
  await page.getByRole('button', { name: 'Save build', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toContainText('could not be saved');
  await expectBuild(page, shared);
  expect(await stored(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expectBuild(page, saved);
});

test('build persistence: corrupt saved JSON uses defaults and a later restore does not discard current choices', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken-json'), SAVED_BUILD_KEY);
  await open(page);
  await expect(page.getByTestId('build-feedback')).toContainText('saved build is invalid');
  await expectBuild(page, DEFAULT_CONFIG);
  await choose(page, shared);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toContainText('saved build could not be read');
  await expectBuild(page, shared);
  expect(await page.evaluate(key => localStorage.getItem(key), SAVED_BUILD_KEY)).toBe('{broken-json');
});

test('build persistence: restoring with no saved build reports the empty state without resetting customization', async ({ page }) => {
  await open(page);
  await choose(page, shared);
  await page.getByRole('button', { name: 'Restore saved', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toContainText(/no saved|nothing saved|save .*first/i);
  await expectBuild(page, shared);
  expect(await stored(page)).toBeNull();
});

test('share links: clipboard denial exposes a selectable fallback URL and keeps the device usable', async ({ page }) => {
  await mockClipboard(page, true);
  await open(page);
  await choose(page, saved);
  await page.getByRole('button', { name: 'Copy share link', exact: true }).click();
  await expect(page.getByTestId('build-feedback')).toHaveText('Clipboard unavailable. Select and copy the link below.');
  const field = page.getByRole('textbox', { name: 'Share link', exact: true });
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(new URL(`/?${serializeConfig(saved)}`, page.url()).href);
  await field.focus();
  await page.keyboard.press('ControlOrMeta+A');
  expect(await field.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionEnd! - input.selectionStart!;
  })).toBe((await field.inputValue()).length);
  await expectBuild(page, saved);
  expect(await stored(page)).toBeNull();
});
