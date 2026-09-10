import { describe, expect, it } from 'vitest';
import { BUTTONS, DEFAULT_CONFIG, FINISHES, SHELLS, configReducer, deserializeConfig, serializeConfig, validateConfig } from './config';
import type { ButtonColor, Configuration, Finish, ShellColor } from './config';

const combinations: Configuration[] = SHELLS.flatMap(({ id: shell }) => BUTTONS.flatMap(({ id: buttons }) =>
  FINISHES.map(({ id: finish }) => ({ version: 2, shell, buttons, finish })),
));

describe('configuration boundary', () => {
  it.each(combinations)('round trips $shell / $buttons / $finish with canonical v2 serialization', (config) => {
    expect(deserializeConfig(serializeConfig(config))).toEqual(config);
    expect(serializeConfig(config)).toBe(`v=2&s=${config.shell}&b=${config.buttons}&f=${config.finish}`);
  });

  it.each(SHELLS)('migrates explicit v1 $id objects and URLs with default buttons and finish', ({ id: shell }) => {
    const migrated = { version: 2, shell, buttons: 'charcoal', finish: 'solid' };
    expect(validateConfig({ version: 1, shell })).toEqual(migrated);
    const restored = deserializeConfig(`v=1&s=${shell}`);
    expect(restored).toEqual(migrated);
    expect(serializeConfig(restored!)).toBe(`v=2&s=${shell}&b=charcoal&f=solid`);
  });

  it.each([
    null, [], {}, true, 'chalk',
    { version: 3, shell: 'chalk', buttons: 'charcoal', finish: 'solid' },
    { ...DEFAULT_CONFIG, version: '2' },
    { ...DEFAULT_CONFIG, shell: '#fff' },
    { ...DEFAULT_CONFIG, buttons: 'unknown' },
    { ...DEFAULT_CONFIG, finish: 'glass' },
    { ...DEFAULT_CONFIG, finish: null },
    { ...DEFAULT_CONFIG, extra: true },
    { ...DEFAULT_CONFIG, [Symbol('extra')]: true },
    { version: 2, shell: 'chalk' },
    { version: 2, shell: 'chalk', buttons: 'charcoal' },
    { version: 2, shell: 'chalk', finish: 'solid' },
    { shell: 'chalk', buttons: 'charcoal', finish: 'solid' },
    { version: 1, shell: 'unknown' },
    { version: '1', shell: 'chalk' },
    { version: 1, shell: 'chalk', buttons: 'ivory' },
    { version: 1, shell: 'chalk', finish: 'solid' },
    { version: 1, shell: 'chalk', arbitrary: true },
  ])('rejects malformed or unsupported objects: %j', (input) => {
    expect(validateConfig(input)).toBeNull();
  });

  it('requires own schema fields and rejects nonenumerable extras', () => {
    expect(validateConfig(Object.create(DEFAULT_CONFIG))).toBeNull();
    const input = Object.defineProperty({ ...DEFAULT_CONFIG }, 'extra', { value: true });
    expect(validateConfig(input)).toBeNull();
  });

  it.each([
    '', 'v=2&s=chalk', 'v=2&s=chalk&b=charcoal', 'v=2&s=chalk&f=solid',
    's=chalk&b=charcoal&f=solid', 'v=3&s=chalk&b=charcoal&f=solid',
    'v=02&s=chalk&b=charcoal&f=solid', 'v=2&s=unknown&b=charcoal&f=solid',
    'v=2&s=chalk&b=unknown&f=solid', 'v=2&s=chalk&b=charcoal&f=glass',
    'v=2&s=chalk&b=&f=solid', 'v=2&s=chalk&b=charcoal&f=',
    'v=2&s=chalk&b=charcoal&f=solid&x=1',
    'v=2&s=chalk&b=charcoal&f=solid&v=2',
    'v=2&s=chalk&b=charcoal&f=solid&s=ember',
    'v=2&s=chalk&b=charcoal&f=solid&b=ivory',
    'v=2&s=chalk&b=charcoal&f=solid&f=translucent',
    'v=2&s=chalk&b=charcoal&b=ivory',
    'v=2&s=%FF&b=charcoal&f=solid',
    'v=1', 's=chalk', 'v=1&s=unknown', 'v=1&s=chalk&s=ember',
    'v=1&v=1&s=chalk', 'v=1&s=chalk&x=1',
    'v=1&s=chalk&b=charcoal&f=solid', 'x'.repeat(129),
  ])('rejects invalid serialized state: %s', (encoded) => {
    expect(deserializeConfig(encoded)).toBeNull();
  });

  it('accepts query parameter order independently of canonical output order', () => {
    const restored = deserializeConfig('f=translucent&b=signal&s=graphite&v=2');
    expect(restored).toEqual({ version: 2, shell: 'graphite', buttons: 'signal', finish: 'translucent' });
    expect(serializeConfig(restored!)).toBe('v=2&s=graphite&b=signal&f=translucent');
  });

  it('refuses to serialize invalid runtime state', () => {
    expect(() => serializeConfig({ ...DEFAULT_CONFIG, finish: 'unknown' } as unknown as Configuration)).toThrow(TypeError);
  });

  it('does not retain caller-owned configuration objects', () => {
    const input = { version: 2, shell: 'chalk', buttons: 'charcoal', finish: 'solid' };
    const result = validateConfig(input);
    input.shell = 'ember'; input.buttons = 'signal'; input.finish = 'translucent';
    expect(result).toEqual(DEFAULT_CONFIG);
  });
});

describe('configuration transitions', () => {
  it('changes shell, buttons and finish independently without mutating prior builds', () => {
    const shell = configReducer(DEFAULT_CONFIG, { type: 'select-shell', shell: 'graphite' });
    const buttons = configReducer(shell, { type: 'select-buttons', buttons: 'ivory' });
    const finish = configReducer(buttons, { type: 'select-finish', finish: 'translucent' });
    expect(shell).toEqual({ version: 2, shell: 'graphite', buttons: 'charcoal', finish: 'solid' });
    expect(buttons).toEqual({ version: 2, shell: 'graphite', buttons: 'ivory', finish: 'solid' });
    expect(finish).toEqual({ version: 2, shell: 'graphite', buttons: 'ivory', finish: 'translucent' });
    expect(DEFAULT_CONFIG).toEqual({ version: 2, shell: 'chalk', buttons: 'charcoal', finish: 'solid' });
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
  });

  it('preserves object identity for unchanged selections and invalid runtime choices', () => {
    const state: Configuration = { version: 2, shell: 'ember', buttons: 'signal', finish: 'translucent' };
    expect(configReducer(state, { type: 'select-shell', shell: 'ember' })).toBe(state);
    expect(configReducer(state, { type: 'select-buttons', buttons: 'signal' })).toBe(state);
    expect(configReducer(state, { type: 'select-finish', finish: 'translucent' })).toBe(state);
    expect(configReducer(state, { type: 'select-shell', shell: 'unknown' as ShellColor })).toBe(state);
    expect(configReducer(state, { type: 'select-buttons', buttons: 'unknown' as ButtonColor })).toBe(state);
    expect(configReducer(state, { type: 'select-finish', finish: 'unknown' as Finish })).toBe(state);
  });

  it('resets all independent choices idempotently', () => {
    const state: Configuration = { version: 2, shell: 'ember', buttons: 'ivory', finish: 'translucent' };
    const reset = configReducer(state, { type: 'reset' });
    expect(reset).toBe(DEFAULT_CONFIG);
    expect(configReducer(reset, { type: 'reset' })).toBe(DEFAULT_CONFIG);
  });

  it('keeps the current build on invalid restore and replaces it on valid v2 restore', () => {
    const state: Configuration = { version: 2, shell: 'graphite', buttons: 'ivory', finish: 'translucent' };
    expect(configReducer(state, { type: 'restore', value: { ...state, version: 9 } })).toBe(state);
    expect(configReducer(state, { type: 'restore', value: { ...state, finish: 'unknown' } })).toBe(state);
    const value: Configuration = { version: 2, shell: 'ember', buttons: 'signal', finish: 'solid' };
    const restored = configReducer(state, { type: 'restore', value });
    expect(restored).toEqual(value);
    expect(restored).not.toBe(value);
  });

  it('restores legacy builds with migration defaults, not the current independent choices', () => {
    const state: Configuration = { version: 2, shell: 'graphite', buttons: 'ivory', finish: 'translucent' };
    expect(configReducer(state, { type: 'restore', value: { version: 1, shell: 'ember' } })).toEqual({
      version: 2, shell: 'ember', buttons: 'charcoal', finish: 'solid',
    });
  });
});
