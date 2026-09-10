export const SHELLS = [
  { id: 'chalk', name: 'Chalk', hex: '#dad5c8', code: '01', description: 'Warm white. Quietly classic.' },
  { id: 'graphite', name: 'Graphite', hex: '#363d3b', code: '02', description: 'Deep charcoal. All business.' },
  { id: 'ember', name: 'Ember', hex: '#cf532f', code: '03', description: 'Burnt orange. A little louder.' },
] as const;

export type ShellColor = (typeof SHELLS)[number]['id'];
export type Configuration = Readonly<{ version: 1; shell: ShellColor }>;
export const DEFAULT_CONFIG: Configuration = Object.freeze({ version: 1, shell: 'chalk' });

export function isShellColor(value: unknown): value is ShellColor {
  return SHELLS.some((shell) => shell.id === value);
}

// Boundary validation is deliberately independent of React, Three, and storage.
export function validateConfig(value: unknown): Configuration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || record.version !== 1 || !isShellColor(record.shell)) return null;
  return { version: 1, shell: record.shell };
}

export function serializeConfig(config: Configuration): string {
  const valid = validateConfig(config);
  if (!valid) throw new TypeError('Invalid handheld configuration');
  return new URLSearchParams({ v: String(valid.version), s: valid.shell }).toString();
}

export function deserializeConfig(encoded: string): Configuration | null {
  if (typeof encoded !== 'string' || encoded.length > 128) return null;
  const params = new URLSearchParams(encoded);
  const keys = [...params.keys()];
  if (keys.length !== 2 || !keys.includes('v') || !keys.includes('s') || params.get('v') !== '1') return null;
  return validateConfig({ version: 1, shell: params.get('s') });
}

export type ConfigAction =
  | { type: 'select-shell'; shell: ShellColor }
  | { type: 'restore'; value: unknown }
  | { type: 'reset' };

export function configReducer(state: Configuration, action: ConfigAction): Configuration {
  switch (action.type) {
    case 'select-shell':
      return isShellColor(action.shell) && action.shell !== state.shell ? { ...state, shell: action.shell } : state;
    case 'restore':
      return validateConfig(action.value) ?? state;
    case 'reset':
      return DEFAULT_CONFIG;
  }
}
