import { describe, expect, it } from 'vitest';
import { createGame, updateGame } from './engine';
import type { GameState } from './engine';

function advance(state: GameState, seconds: number, step = 1 / 60): GameState {
  let next = state;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    next = updateGame(next, { type: 'tick', seconds: Math.min(step, seconds - elapsed) });
  }
  return next;
}

function start() { return updateGame(createGame(), { type: 'start' }); }

describe('Signal Run simulation', () => {
  it('starts in a quiet ready state and teaches collecting before a hazard arrives', () => {
    const ready = createGame();
    expect(ready).toMatchObject({ phase: 'ready', lane: 1, score: 0, elapsed: 0, entities: [] });
    expect(updateGame(ready, { type: 'tick', seconds: 0.1 })).toBe(ready);
    const playing = start();
    expect(playing).toMatchObject({ phase: 'running', score: 0 });
    expect(playing.entities).toEqual([{ id: 0, kind: 'signal', lane: 1, born: 0, progress: 0 }]);
    expect(advance(playing, 1.9).score).toBe(0);
    const collected = advance(playing, 2);
    expect(collected.score).toBe(10);
    expect(advance(collected, 0.8).score).toBe(10);
    expect(advance(playing, 4.9).phase).toBe('running');
    expect(advance(playing, 5)).toMatchObject({ phase: 'over', score: 10, elapsed: 5 });
  });

  it('collects only in the selected lane and survives a correctly timed dodge', () => {
    let playing = updateGame(start(), { type: 'move', direction: -1 });
    playing = advance(playing, 3.2);
    expect(playing).toMatchObject({ lane: 0, score: 10, phase: 'running' });
    playing = advance(playing, 1.8);
    expect(playing).toMatchObject({ lane: 0, score: 10, phase: 'running' });
  });

  it('bounds movement to three lanes and ignores movement outside an active run', () => {
    const ready = createGame();
    expect(updateGame(ready, { type: 'move', direction: 1 })).toBe(ready);
    let playing = start();
    for (let index = 0; index < 9; index += 1) playing = updateGame(playing, { type: 'move', direction: -1 });
    expect(playing.lane).toBe(0);
    expect(updateGame(playing, { type: 'move', direction: -1 })).toBe(playing);
    for (let index = 0; index < 9; index += 1) playing = updateGame(playing, { type: 'move', direction: 1 });
    expect(playing.lane).toBe(2);
    const paused = updateGame(playing, { type: 'pause' });
    expect(updateGame(paused, { type: 'move', direction: -1 })).toBe(paused);
  });

  it('pauses without advancing or losing the run, and resumes from exactly that state', () => {
    const playing = advance(start(), 2.5);
    const paused = updateGame(playing, { type: 'pause' });
    expect(paused.phase).toBe('paused');
    expect(advance(paused, 8)).toBe(paused);
    expect(updateGame(paused, { type: 'pause' })).toBe(paused);
    const resumed = updateGame(paused, { type: 'resume' });
    expect(resumed).toEqual(playing);
    expect(updateGame(resumed, { type: 'resume' })).toBe(resumed);
    expect(advance(resumed, 2.5)).toMatchObject({ phase: 'over', elapsed: 5 });
  });

  it('stops on collision and restarts every field, including deterministic random state', () => {
    const over = advance(start(), 5.2);
    expect(over.phase).toBe('over');
    expect(advance(over, 2)).toBe(over);
    expect(updateGame(over, { type: 'move', direction: 1 })).toBe(over);
    expect(updateGame(over, { type: 'resume' })).toBe(over);
    expect(updateGame(over, { type: 'start' })).toBe(over);
    expect(updateGame(over, { type: 'restart' })).toEqual(start());
    expect(updateGame(updateGame(start(), { type: 'pause' }), { type: 'restart' })).toEqual(start());
  });

  it('does not mutate input state or its existing entity records', () => {
    const playing = start();
    playing.entities.forEach(Object.freeze);
    Object.freeze(playing.entities);
    Object.freeze(playing);
    const snapshot = JSON.stringify(playing);
    const next = advance(playing, 0.2);
    expect(next).not.toBe(playing);
    expect(next.entities[0]).not.toBe(playing.entities[0]);
    expect(JSON.stringify(playing)).toBe(snapshot);
  });

  it.each([Number.NaN, Infinity, -Infinity, -1, 0, 0.251, 2, 3600])('ignores unsafe elapsed delta %s', (seconds) => {
    const playing = start();
    expect(updateGame(playing, { type: 'tick', seconds })).toBe(playing);
  });

  it('detects collision crossings in the largest supported timestep', () => {
    const playing = advance(start(), 4.9);
    const over = updateGame(playing, { type: 'tick', seconds: 0.25 });
    expect(over).toMatchObject({ phase: 'over', score: 10, elapsed: 5 });
    expect(over.entities[0]).toMatchObject({ kind: 'hazard', lane: 1, progress: 1 });
  });

  it('has identical seeded outcomes across fixed-timestep replays', () => {
    function replay() {
      let state = start();
      for (let tick = 0; tick < 600; tick += 1) {
        if (tick === 130 || tick === 240) state = updateGame(state, { type: 'move', direction: -1 });
        if (tick === 320) state = updateGame(state, { type: 'move', direction: 1 });
        state = updateGame(state, { type: 'tick', seconds: 1 / 60 });
      }
      return state;
    }
    expect(replay()).toEqual(replay());
    expect(replay().nextEntity).toBeGreaterThan(4);
  });

  it('preserves event timing when elapsed time is partitioned into different frame sizes', () => {
    const fine = advance(start(), 3.25, 1 / 120);
    const coarse = advance(start(), 3.25, 0.25);
    expect(fine.phase).toBe(coarse.phase);
    expect(fine.score).toBe(coarse.score);
    expect(fine.nextSpawn).toBe(coarse.nextSpawn);
    expect(fine.seed).toBe(coarse.seed);
    expect(fine.entities.map(({ id, lane, kind, born }) => ({ id, lane, kind, born })))
      .toEqual(coarse.entities.map(({ id, lane, kind, born }) => ({ id, lane, kind, born })));
    fine.entities.forEach((entity, index) => expect(entity.progress).toBeCloseTo(coarse.entities[index].progress, 9));
    expect(advance(start(), 5.2, 1 / 120)).toEqual(advance(start(), 5.2, 0.25));
  });
});
