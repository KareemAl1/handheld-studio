import { DEFAULT_CONFIG, deserializeConfig, serializeConfig, validateConfig } from './config';
import type { Configuration } from './config';

export const SAVED_BUILD_KEY = 'handheld-studio.saved-build';
export const MAX_SAVED_BUILD_LENGTH = 512;

// Resolve storage inside the guarded operation: even reading window.localStorage
// can throw when browser privacy settings or a sandbox deny access.
export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'> | null;

type BuildFailure = { status: 'invalid' | 'unavailable'; message: string };
export type ReadSavedBuildResult = { status: 'saved'; config: Configuration } | { status: 'empty' } | BuildFailure;
export type WriteSavedBuildResult = { status: 'saved'; config: Configuration } | BuildFailure;
export type InitialBuild = { config: Configuration; source: 'shared' | 'saved' | 'default'; message?: string };

const STORAGE_UNAVAILABLE = 'Local storage is unavailable. You can still customize and copy a share link.';
const INVALID_SAVED_BUILD = 'The saved build could not be read. Your current build is unchanged.';

export function readSavedBuild(getStorage: StorageAccess): ReadSavedBuildResult {
  let encoded: string | null;
  try {
    const storage = getStorage();
    if (!storage) return { status: 'unavailable', message: STORAGE_UNAVAILABLE };
    encoded = storage.getItem(SAVED_BUILD_KEY);
  } catch {
    return { status: 'unavailable', message: STORAGE_UNAVAILABLE };
  }
  if (encoded === null) return { status: 'empty' };
  if (encoded.length > MAX_SAVED_BUILD_LENGTH) return { status: 'invalid', message: INVALID_SAVED_BUILD };
  try {
    const config = validateConfig(JSON.parse(encoded));
    return config ? { status: 'saved', config } : { status: 'invalid', message: INVALID_SAVED_BUILD };
  } catch {
    return { status: 'invalid', message: INVALID_SAVED_BUILD };
  }
}

export function writeSavedBuild(value: unknown, getStorage: StorageAccess): WriteSavedBuildResult {
  let config: Configuration | null;
  try {
    config = validateConfig(value);
  } catch {
    config = null;
  }
  if (!config) return { status: 'invalid', message: 'This build is invalid and could not be saved.' };
  try {
    const storage = getStorage();
    if (!storage) return { status: 'unavailable', message: STORAGE_UNAVAILABLE };
    storage.setItem(SAVED_BUILD_KEY, JSON.stringify(config));
    return { status: 'saved', config };
  } catch {
    return { status: 'unavailable', message: 'The build could not be saved. Storage may be blocked or full; you can copy a share link instead.' };
  }
}

// A share link is an explicit preview, not an implicit save. Do not even resolve
// storage for a valid link, so opening one cannot replace the user's saved build.
export function getInitialBuild(search: string, getStorage: StorageAccess): InitialBuild {
  const encoded = search.startsWith('?') ? search.slice(1) : search;
  if (encoded) {
    const config = deserializeConfig(encoded);
    if (config) return { config, source: 'shared', message: 'Shared build loaded. Save it to keep it on this browser.' };
  }

  const saved = readSavedBuild(getStorage);
  const invalidLink = encoded ? 'This share link is invalid or unsupported.' : '';
  if (saved.status === 'saved') {
    return { config: saved.config, source: 'saved', message: `${invalidLink ? `${invalidLink} ` : ''}Your saved build was restored.` };
  }
  const feedback = [invalidLink];
  if (saved.status === 'invalid') feedback.push('The saved build is invalid or unreadable.');
  if (saved.status === 'unavailable') feedback.push(STORAGE_UNAVAILABLE);
  if (feedback.some(Boolean)) feedback.push('The default build is shown.');
  return { config: DEFAULT_CONFIG, source: 'default', ...(feedback.some(Boolean) ? { message: feedback.filter(Boolean).join(' ') } : {}) };
}

export function makeShareUrl(config: Configuration, currentHref: string): string {
  const url = new URL(currentHref);
  url.search = serializeConfig(config);
  url.hash = '';
  return url.href;
}
