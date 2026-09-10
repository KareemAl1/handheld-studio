import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, SHELLS, configReducer, deserializeConfig, serializeConfig, validateConfig } from './config';

describe('configuration boundary', () => {
  it.each(SHELLS)('round trips $id with canonical versioned serialization', ({ id }) => {
    const config = { version: 1 as const, shell: id };
    expect(deserializeConfig(serializeConfig(config))).toEqual(config);
    expect(serializeConfig(config)).toBe(`v=1&s=${id}`);
  });
  it.each([null, [], {}, { version: 2, shell: 'chalk' }, { version: 1, shell: '#fff' },
    { version: 1, shell: 'chalk', arbitrary: true }, { shell: 'chalk' }, { version: '1', shell: 'chalk' }])(
    'rejects malformed or unsupported input: %j', (input) => expect(validateConfig(input)).toBeNull(),
  );
  it.each(['', 'v=2&s=chalk', 'v=1', 's=chalk', 'v=1&s=unknown', 'v=1&s=chalk&s=ember',
    'v=1&s=chalk&x=1', 'v=1&v=1&s=chalk', 'v=1&s=%FF', 'x'.repeat(129)])(
    'rejects invalid serialized state: %s', (encoded) => expect(deserializeConfig(encoded)).toBeNull(),
  );
  it('does not retain a caller-owned object', () => {
    const input = { version: 1, shell: 'chalk' };
    const result = validateConfig(input);
    input.shell = 'ember';
    expect(result).toEqual(DEFAULT_CONFIG);
  });
});

describe('configuration transitions', () => {
  it('changes shell without mutating previous state, then resets idempotently', () => {
    const changed = configReducer(DEFAULT_CONFIG, { type: 'select-shell', shell: 'ember' });
    expect(changed).toEqual({ version: 1, shell: 'ember' });
    expect(DEFAULT_CONFIG.shell).toBe('chalk');
    const reset = configReducer(changed, { type: 'reset' });
    expect(configReducer(reset, { type: 'reset' })).toEqual(DEFAULT_CONFIG);
  });
  it('preserves a valid current build when restoration fails', () => {
    const state = configReducer(DEFAULT_CONFIG, { type: 'select-shell', shell: 'graphite' });
    expect(configReducer(state, { type: 'restore', value: { version: 9, shell: 'chalk' } })).toBe(state);
    expect(configReducer(state, { type: 'restore', value: { version: 1, shell: 'ember' } }).shell).toBe('ember');
  });
});
