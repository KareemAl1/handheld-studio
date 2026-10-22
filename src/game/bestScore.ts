import type { StorageAccess } from '../config/persistence';

export const BEST_SCORE_KEY = 'handheld-studio.signal-run-best';
export const MAX_BEST_SCORE = 999_999;

export type BestScoreRecord = { best: number; isNew: boolean; saved: boolean };

/** Accepts only a plain non-negative integer string; anything else reads as no record. */
export function parseBestScore(raw: string | null): number {
  if (raw === null || raw.length > String(MAX_BEST_SCORE).length || !/^\d+$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= MAX_BEST_SCORE ? value : 0;
}

// Storage access can throw in private modes or sandboxes; a missing record is never an error.
export function readBestScore(getStorage: StorageAccess): number {
  try {
    const storage = getStorage();
    return storage ? parseBestScore(storage.getItem(BEST_SCORE_KEY)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Records a finished run. A best only changes when the run beats it, so a zero
 * score never counts. When storage is blocked the best still holds in memory.
 */
export function recordScore(score: number, previousBest: number, getStorage: StorageAccess): BestScoreRecord {
  if (!Number.isSafeInteger(score) || score <= previousBest || score > MAX_BEST_SCORE) {
    return { best: previousBest, isNew: false, saved: false };
  }
  try {
    const storage = getStorage();
    if (!storage) return { best: score, isNew: true, saved: false };
    storage.setItem(BEST_SCORE_KEY, String(score));
    return { best: score, isNew: true, saved: true };
  } catch {
    return { best: score, isNew: true, saved: false };
  }
}
