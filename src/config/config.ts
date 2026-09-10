export const SHELLS = [
  { id: 'chalk', name: 'Chalk', hex: '#dad5c8', code: '01', description: 'Warm white. Quietly classic.' },
  { id: 'graphite', name: 'Graphite', hex: '#363d3b', code: '02', description: 'Deep charcoal. All business.' },
  { id: 'ember', name: 'Ember', hex: '#cf532f', code: '03', description: 'Burnt orange. A little louder.' },
] as const;

export const BUTTONS = [
  { id: 'charcoal', name: 'Charcoal', hex: '#333b37' },
  { id: 'ivory', name: 'Ivory', hex: '#ddd6c5' },
  { id: 'signal', name: 'Signal', hex: '#cf532f' },
] as const;

export const FINISHES = [
  { id: 'solid', name: 'Solid' },
  { id: 'translucent', name: 'Translucent' },
] as const;

export type ShellColor = (typeof SHELLS)[number]['id'];
export type ButtonColor = (typeof BUTTONS)[number]['id'];
export type Finish = (typeof FINISHES)[number]['id'];
export type Configuration = Readonly<{ version: 2; shell: ShellColor; buttons: ButtonColor; finish: Finish }>;
export const DEFAULT_CONFIG: Configuration = Object.freeze({ version: 2, shell: 'chalk', buttons: 'charcoal', finish: 'solid' });

export function isShellColor(value: unknown): value is ShellColor {
  return SHELLS.some((shell) => shell.id === value);
}

export function isButtonColor(value: unknown): value is ButtonColor {
  return BUTTONS.some((buttons) => buttons.id === value);
}

export function isFinish(value: unknown): value is Finish {
  return FINISHES.some((finish) => finish.id === value);
}

function hasExactKeys(keys: readonly PropertyKey[], expected: readonly string[]): boolean {
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

// Boundary validation is deliberately independent of React, Three, and storage.
export function validateConfig(value: unknown): Configuration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  if (record.version === 1 && hasExactKeys(keys, ['version', 'shell']) && isShellColor(record.shell)) {
    return { ...DEFAULT_CONFIG, shell: record.shell };
  }
  if (record.version !== 2 || !hasExactKeys(keys, ['version', 'shell', 'buttons', 'finish'])
    || !isShellColor(record.shell) || !isButtonColor(record.buttons) || !isFinish(record.finish)) return null;
  return { version: 2, shell: record.shell, buttons: record.buttons, finish: record.finish };
}

export function serializeConfig(config: Configuration): string {
  const valid = validateConfig(config);
  if (!valid) throw new TypeError('Invalid handheld configuration');
  return new URLSearchParams({ v: '2', s: valid.shell, b: valid.buttons, f: valid.finish }).toString();
}

export function deserializeConfig(encoded: string): Configuration | null {
  if (typeof encoded !== 'string' || encoded.length > 128) return null;
  const params = new URLSearchParams(encoded);
  const keys = [...params.keys()];
  if (params.get('v') === '1' && hasExactKeys(keys, ['v', 's'])) {
    return validateConfig({ version: 1, shell: params.get('s') });
  }
  if (params.get('v') !== '2' || !hasExactKeys(keys, ['v', 's', 'b', 'f'])) return null;
  return validateConfig({ version: 2, shell: params.get('s'), buttons: params.get('b'), finish: params.get('f') });
}

export type ConfigAction =
  | { type: 'select-shell'; shell: ShellColor }
  | { type: 'select-buttons'; buttons: ButtonColor }
  | { type: 'select-finish'; finish: Finish }
  | { type: 'restore'; value: unknown }
  | { type: 'reset' };

export function configReducer(state: Configuration, action: ConfigAction): Configuration {
  switch (action.type) {
    case 'select-shell':
      return isShellColor(action.shell) && action.shell !== state.shell ? { ...state, shell: action.shell } : state;
    case 'select-buttons':
      return isButtonColor(action.buttons) && action.buttons !== state.buttons ? { ...state, buttons: action.buttons } : state;
    case 'select-finish':
      return isFinish(action.finish) && action.finish !== state.finish ? { ...state, finish: action.finish } : state;
    case 'restore':
      return validateConfig(action.value) ?? state;
    case 'reset':
      return DEFAULT_CONFIG;
  }
}
