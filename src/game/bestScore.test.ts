import { describe, expect, it, vi } from 'vitest';
import { BEST_SCORE_KEY, MAX_BEST_SCORE, parseBestScore, readBestScore, recordScore } from './bestScore';
import { GameSession } from './session';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage = {
    getItem: vi.fn((key: string) => key === BEST_SCORE_KEY ? value : null),
    setItem: vi.fn((key: string, next: string) => { if (key === BEST_SCORE_KEY) value = next; }),
  };
  return { storage, getStorage: () => storage, value: () => value };
}

function blocked() {
  return () => { throw new Error('denied'); };
}

// Standing still in the middle lane collects one diamond, then meets the first cross at 5 seconds.
function finishRun(session: GameSession) {
  session.dispatch({ type: session.getState().phase === 'over' ? 'restart' : 'start' });
  for (let step = 0; step < 6 * 30 && session.getState().phase === 'running'; step += 1) session.advance(1 / 30);
}

describe('best score parsing', () => {
  it.each([[null, 0], ['', 0], ['0', 0], ['120', 120], [String(MAX_BEST_SCORE), MAX_BEST_SCORE]])('reads %s as %s', (raw, expected) => {
    expect(parseBestScore(raw)).toBe(expected);
  });

  it.each(['-5', '1.5', '1e3', ' 10', 'abc', '0x10', String(MAX_BEST_SCORE + 1), '9'.repeat(40)])('treats malformed %s as no record', (raw) => {
    expect(parseBestScore(raw)).toBe(0);
  });
});

describe('best score storage', () => {
  it('saves only a run that beats the current best', () => {
    const context = memoryStorage('40');
    expect(readBestScore(context.getStorage)).toBe(40);
    expect(recordScore(30, 40, context.getStorage)).toEqual({ best: 40, isNew: false, saved: false });
    expect(recordScore(40, 40, context.getStorage)).toEqual({ best: 40, isNew: false, saved: false });
    expect(context.storage.setItem).not.toHaveBeenCalled();
    expect(recordScore(50, 40, context.getStorage)).toEqual({ best: 50, isNew: true, saved: true });
    expect(context.value()).toBe('50');
  });

  it('never counts a zero score as a new best', () => {
    const context = memoryStorage();
    expect(recordScore(0, 0, context.getStorage)).toEqual({ best: 0, isNew: false, saved: false });
    expect(context.storage.setItem).not.toHaveBeenCalled();
  });

  it('rejects invalid scores without touching storage', () => {
    const context = memoryStorage('10');
    for (const score of [Number.NaN, Infinity, 12.5, MAX_BEST_SCORE + 1]) {
      expect(recordScore(score, 10, context.getStorage)).toEqual({ best: 10, isNew: false, saved: false });
    }
    expect(context.storage.setItem).not.toHaveBeenCalled();
  });

  it('keeps a new best in memory when storage is missing or blocked', () => {
    expect(readBestScore(blocked())).toBe(0);
    expect(recordScore(20, 0, blocked())).toEqual({ best: 20, isNew: true, saved: false });
    expect(recordScore(20, 0, () => null)).toEqual({ best: 20, isNew: true, saved: false });
  });
});

describe('best score in a game session', () => {
  it('records a finished run once and restores it in a new session', () => {
    const context = memoryStorage();
    const session = new GameSession({ getStorage: context.getStorage });
    expect(session.getSnapshot()).toMatchObject({ best: 0, newBest: false });
    finishRun(session);
    expect(session.getSnapshot()).toMatchObject({ phase: 'over', score: 10, best: 10, newBest: true });
    expect(context.storage.setItem).toHaveBeenCalledTimes(1);
    session.advance(1);
    expect(context.storage.setItem).toHaveBeenCalledTimes(1);
    expect(new GameSession({ getStorage: context.getStorage }).getSnapshot()).toMatchObject({ best: 10, newBest: false });
  });

  it('clears the new-best flag on restart and does not repeat it for an equal run', () => {
    const context = memoryStorage();
    const session = new GameSession({ getStorage: context.getStorage });
    finishRun(session);
    session.dispatch({ type: 'restart' });
    expect(session.getSnapshot()).toMatchObject({ phase: 'running', best: 10, newBest: false });
    finishRun(session);
    expect(session.getSnapshot()).toMatchObject({ phase: 'over', score: 10, best: 10, newBest: false });
    session.reset();
    expect(session.getSnapshot()).toMatchObject({ phase: 'ready', best: 10, newBest: false });
  });

  it('works without storage by default', () => {
    const session = new GameSession();
    finishRun(session);
    expect(session.getSnapshot()).toMatchObject({ phase: 'over', best: 10, newBest: true });
  });
});
