import { describe, expect, it, vi } from 'vitest';
import { BUTTONS, DEFAULT_CONFIG, FINISHES, SHELLS, serializeConfig } from './config';
import type { Configuration } from './config';
import { getInitialBuild, makeShareUrl, MAX_SAVED_BUILD_LENGTH, readSavedBuild, SAVED_BUILD_KEY, writeSavedBuild } from './persistence';
import type { StorageAccess } from './persistence';

const savedConfig: Configuration = { version: 2, shell: 'graphite', buttons: 'ivory', finish: 'translucent' };
const sharedConfig: Configuration = { version: 2, shell: 'ember', buttons: 'signal', finish: 'solid' };

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage = {
    getItem: vi.fn((key: string) => key === SAVED_BUILD_KEY ? value : null),
    setItem: vi.fn((key: string, next: string) => { if (key === SAVED_BUILD_KEY) value = next; }),
  };
  const getStorage = vi.fn(() => storage);
  return { storage, getStorage, value: () => value };
}

describe('explicit local build persistence', () => {
  it('restores a saved build after recreating the storage adapter, without changing unrelated keys', () => {
    const first = memoryStorage();
    expect(readSavedBuild(first.getStorage)).toEqual({ status: 'empty' });
    expect(writeSavedBuild(savedConfig, first.getStorage)).toEqual({ status: 'saved', config: savedConfig });
    expect(first.storage.setItem).toHaveBeenCalledExactlyOnceWith(SAVED_BUILD_KEY, JSON.stringify(savedConfig));
    const reloaded = memoryStorage(first.value());
    expect(readSavedBuild(reloaded.getStorage)).toEqual({ status: 'saved', config: savedConfig });
    expect(getInitialBuild('', reloaded.getStorage)).toMatchObject({ config: savedConfig, source: 'saved' });
    expect(reloaded.storage.setItem).not.toHaveBeenCalled();
  });

  it('overwrites one saved build only after an explicit successful save', () => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    expect(writeSavedBuild(sharedConfig, context.getStorage).status).toBe('saved');
    expect(readSavedBuild(context.getStorage)).toEqual({ status: 'saved', config: sharedConfig });
    expect(context.storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('migrates stored v1 builds and saves canonical v2 JSON', () => {
    const context = memoryStorage(JSON.stringify({ version: 1, shell: 'ember' }));
    const migrated = { ...DEFAULT_CONFIG, shell: 'ember' };
    expect(readSavedBuild(context.getStorage)).toEqual({ status: 'saved', config: migrated });
    expect(writeSavedBuild({ version: 1, shell: 'ember' }, context.getStorage)).toEqual({ status: 'saved', config: migrated });
    expect(context.value()).toBe(JSON.stringify(migrated));
  });

  it.each(['', '{invalid json', 'null', '[]', '{}', '{"version":99,"shell":"chalk"}', JSON.stringify({ ...savedConfig, extra: true })])(
    'rejects malformed saved data without deleting or replacing it: %s', (encoded) => {
      const context = memoryStorage(encoded);
      expect(readSavedBuild(context.getStorage)).toMatchObject({ status: 'invalid', message: expect.any(String) });
      expect(context.value()).toBe(encoded);
      expect(context.storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('bounds JSON input before parsing while permitting data at the boundary', () => {
    const configJson = JSON.stringify(savedConfig);
    const boundary = configJson.padEnd(MAX_SAVED_BUILD_LENGTH);
    expect(readSavedBuild(memoryStorage(boundary).getStorage)).toEqual({ status: 'saved', config: savedConfig });
    expect(readSavedBuild(memoryStorage(`${boundary} `).getStorage).status).toBe('invalid');
  });

  it.each([
    ['missing storage', () => null],
    ['throwing access getter', () => { throw new DOMException('Denied', 'SecurityError'); }],
    ['throwing getItem', () => ({ getItem() { throw new Error('Denied'); }, setItem() {} })],
  ] satisfies [string, StorageAccess][])('reports unavailable reads: %s', (_name, getStorage) => {
    expect(readSavedBuild(getStorage)).toMatchObject({ status: 'unavailable', message: expect.any(String) });
    expect(getInitialBuild('', getStorage)).toMatchObject({ config: DEFAULT_CONFIG, source: 'default', message: expect.stringContaining('unavailable') });
  });

  it('reports a full store without claiming success or changing the prior saved build', () => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    context.storage.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    expect(writeSavedBuild(sharedConfig, context.getStorage)).toMatchObject({ status: 'unavailable', message: expect.stringContaining('could not be saved') });
    expect(context.value()).toBe(JSON.stringify(savedConfig));
  });

  it('catches denied access before writes and handles missing storage', () => {
    const denied = () => { throw new DOMException('Denied', 'SecurityError'); };
    expect(writeSavedBuild(savedConfig, denied).status).toBe('unavailable');
    expect(writeSavedBuild(savedConfig, () => null).status).toBe('unavailable');
  });

  it('validates a save before resolving storage, including exceptional object access', () => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    const exceptional = Object.defineProperty({}, 'version', { get() { throw new Error('Invalid input'); } });
    for (const invalid of [null, { ...savedConfig, buttons: 'pink' }, { ...savedConfig, extra: true }, exceptional]) {
      expect(writeSavedBuild(invalid, context.getStorage).status).toBe('invalid');
    }
    expect(context.getStorage).not.toHaveBeenCalled();
    expect(context.value()).toBe(JSON.stringify(savedConfig));
  });
});

describe('shared build startup and URL generation', () => {
  const combinations: Configuration[] = SHELLS.flatMap(({ id: shell }) => BUTTONS.flatMap(({ id: buttons }) =>
    FINISHES.map(({ id: finish }) => ({ version: 2, shell, buttons, finish })),
  ));

  it.each(combinations)('round trips $shell / $buttons / $finish through the actual share URL boundary', (config) => {
    const currentHref = 'http://127.0.0.1:5173/handheld-studio/?unused=123#detail-views';
    const link = new URL(makeShareUrl(config, currentHref));
    expect(link.origin).toBe('http://127.0.0.1:5173');
    expect(link.pathname).toBe('/handheld-studio/');
    expect(link.hash).toBe('');
    expect(link.search).toBe(`?${serializeConfig(config)}`);
    const context = memoryStorage(JSON.stringify(savedConfig));
    expect(getInitialBuild(link.search, context.getStorage)).toMatchObject({ config, source: 'shared' });
    expect(context.getStorage).not.toHaveBeenCalled();
    expect(currentHref).toBe('http://127.0.0.1:5173/handheld-studio/?unused=123#detail-views');
  });

  it('opens a shared configuration without replacing the saved build, then restores that build on a normal reload', () => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    expect(getInitialBuild(`?${serializeConfig(sharedConfig)}`, context.getStorage)).toMatchObject({ config: sharedConfig, source: 'shared' });
    expect(context.storage.setItem).not.toHaveBeenCalled();
    expect(getInitialBuild('', context.getStorage)).toMatchObject({ config: savedConfig, source: 'saved' });
  });

  it('does not require storage access to open a valid share link', () => {
    const getStorage = vi.fn(() => { throw new Error('Storage must not be accessed'); });
    expect(getInitialBuild(`?${serializeConfig(sharedConfig)}`, getStorage).source).toBe('shared');
    expect(getStorage).not.toHaveBeenCalled();
  });

  it.each([
    '?v=2&s=ember&b=signal',
    '?v=2&s=ember&b=signal&f=solid&unknown=1',
    '?v=2&s=ember&b=signal&f=solid&b=ivory',
    '?v=3&s=ember&b=signal&f=solid',
    '?v=2&s=wrong&b=signal&f=solid',
    `?${'x'.repeat(129)}`,
  ])('falls back to saved data for an invalid query without accepting partial state: %s', (search) => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    expect(getInitialBuild(search, context.getStorage)).toMatchObject({ config: savedConfig, source: 'saved', message: expect.stringContaining('share link is invalid') });
    expect(context.storage.setItem).not.toHaveBeenCalled();
  });

  it('combines invalid URL and invalid saved data feedback without throwing', () => {
    const context = memoryStorage('{broken');
    const result = getInitialBuild('?v=99', context.getStorage);
    expect(result).toMatchObject({ config: DEFAULT_CONFIG, source: 'default' });
    expect(result.message).toContain('share link is invalid');
    expect(result.message).toContain('saved build is invalid');
    expect(result.message).toContain('default build');
  });

  it('reports an invalid URL even when no saved build exists', () => {
    expect(getInitialBuild('?v=99', memoryStorage().getStorage)).toMatchObject({ config: DEFAULT_CONFIG, source: 'default', message: expect.stringContaining('share link is invalid') });
  });

  it('starts quietly with a default build when no query or saved build exists', () => {
    const context = memoryStorage();
    expect(getInitialBuild('', context.getStorage)).toEqual({ config: DEFAULT_CONFIG, source: 'default' });
    expect(getInitialBuild('?', context.getStorage)).toEqual({ config: DEFAULT_CONFIG, source: 'default' });
  });

  it('ignores navigation hashes because startup consumes only URL.search', () => {
    const url = new URL('http://127.0.0.1:5173/#detail-views');
    expect(getInitialBuild(url.search, memoryStorage().getStorage)).toEqual({ config: DEFAULT_CONFIG, source: 'default' });
    expect(makeShareUrl(sharedConfig, url.href)).toBe(`http://127.0.0.1:5173/?${serializeConfig(sharedConfig)}`);
  });

  it('supports old versioned links without writing a migrated saved build automatically', () => {
    const context = memoryStorage(JSON.stringify(savedConfig));
    expect(getInitialBuild('?v=1&s=ember', context.getStorage)).toMatchObject({ config: { ...DEFAULT_CONFIG, shell: 'ember' }, source: 'shared' });
    expect(context.getStorage).not.toHaveBeenCalled();
  });

  it('refuses to generate a link from invalid runtime configuration', () => {
    expect(() => makeShareUrl({ ...savedConfig, finish: 'invalid' } as unknown as Configuration, 'http://127.0.0.1:5173/')).toThrow(TypeError);
  });
});
