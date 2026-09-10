import { describe, expect, it, vi } from 'vitest';
import { GameSession } from './session';

function playing() {
  const session = new GameSession();
  session.dispatch({ type: 'start' });
  return session;
}

function advance(session: GameSession, seconds: number, step = 1 / 30) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += step) {
    session.advance(Math.min(step, seconds - elapsed));
  }
}

describe('game session clock and subscriptions', () => {
  it('accumulates partial frames without painting or notifying the HUD before a simulation step', () => {
    const session = playing();
    const snapshot = session.getSnapshot();
    const paint = vi.fn();
    const notify = vi.fn();
    session.subscribeFrame(paint);
    session.subscribe(notify);

    for (let index = 0; index < 3; index += 1) session.advance(1 / 240);
    expect(session.getState().elapsed).toBe(0);
    expect(paint).not.toHaveBeenCalled();
    session.advance(1 / 240);
    expect(session.getState().elapsed).toBeCloseTo(1 / 60, 12);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toBe(snapshot);
  });

  it('produces the same simulation from fine and coarse frame delivery', () => {
    const fine = playing();
    const coarse = playing();
    advance(fine, 2.5, 1 / 240);
    advance(coarse, 2.5, 1 / 20);
    expect(fine.getState()).toEqual(coarse.getState());
    expect(fine.getSnapshot()).toMatchObject({ phase: 'running', score: 10, lane: 1 });
  });

  it('paints once for multiple simulation steps and publishes only score, lane, or phase changes to React', () => {
    const session = playing();
    const paint = vi.fn();
    const notify = vi.fn();
    session.subscribeFrame(paint);
    session.subscribe(notify);
    session.advance(0.1);
    expect(session.getState().elapsed).toBeCloseTo(0.1, 12);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();

    advance(session, 1.9);
    expect(session.getState().score).toBe(10);
    expect(notify).toHaveBeenCalledTimes(1);
    session.dispatch({ type: 'move', direction: -1 });
    expect(notify).toHaveBeenCalledTimes(2);
    session.dispatch({ type: 'pause' });
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it('retains fractional time across movement without moving the simulation clock', () => {
    const session = playing();
    session.advance(1 / 120);
    session.dispatch({ type: 'move', direction: -1 });
    expect(session.getState()).toMatchObject({ lane: 0, elapsed: 0 });
    session.advance(1 / 120);
    expect(session.getState().elapsed).toBeCloseTo(1 / 60, 12);
    expect(session.getSnapshot().lane).toBe(0);
  });

  it('discards pending fractional time when paused and never advances or paints while paused', () => {
    const session = playing();
    session.advance(1 / 120);
    session.dispatch({ type: 'pause' });
    const paused = session.getState();
    const paint = vi.fn();
    const notify = vi.fn();
    session.subscribeFrame(paint);
    session.subscribe(notify);
    session.advance(100);
    session.dispatch({ type: 'move', direction: 1 });
    session.dispatch({ type: 'tick', seconds: 0.1 });
    expect(session.getState()).toBe(paused);
    expect(paint).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();

    session.dispatch({ type: 'resume' });
    session.advance(1 / 120);
    expect(session.getState().elapsed).toBe(0);
    session.advance(1 / 120);
    expect(session.getState().elapsed).toBeCloseTo(1 / 60, 12);
  });

  it('stops render and UI notifications after game over until an explicit restart', () => {
    const session = playing();
    advance(session, 5.5);
    expect(session.getSnapshot()).toMatchObject({ phase: 'over', score: 10 });
    const over = session.getState();
    const paint = vi.fn();
    const notify = vi.fn();
    session.subscribeFrame(paint);
    session.subscribe(notify);
    advance(session, 3);
    session.dispatch({ type: 'start' });
    session.dispatch({ type: 'pause' });
    session.dispatch({ type: 'resume' });
    session.dispatch({ type: 'move', direction: -1 });
    session.dispatch({ type: 'tick', seconds: 0.1 });
    expect(session.getState()).toBe(over);
    expect(paint).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();

    session.dispatch({ type: 'restart' });
    expect(session.getState()).toEqual(playing().getState());
    expect(paint).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('resets score, lane, entities, and accumulated time when returning to the ready screen', () => {
    const session = playing();
    advance(session, 2);
    session.dispatch({ type: 'move', direction: 1 });
    session.advance(1 / 120);
    session.reset();
    expect(session.getState()).toEqual(new GameSession().getState());
    expect(session.getSnapshot()).toEqual(new GameSession().getSnapshot());
    session.dispatch({ type: 'start' });
    session.advance(1 / 120);
    expect(session.getState().elapsed).toBe(0);
  });

  it('ignores invalid frame deltas and bounds catch-up after a long frame', () => {
    const session = playing();
    const before = session.getState();
    const paint = vi.fn();
    session.subscribeFrame(paint);
    for (const seconds of [0, -1, Number.NaN, Infinity, -Infinity]) session.advance(seconds);
    expect(session.getState()).toBe(before);
    expect(paint).not.toHaveBeenCalled();
    session.advance(30);
    expect(session.getState()).toMatchObject({ phase: 'running', score: 0 });
    expect(session.getState().elapsed).toBeCloseTo(0.1, 12);
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes HUD and texture consumers independently without affecting gameplay', () => {
    const session = playing();
    const paint = vi.fn();
    const notify = vi.fn();
    const stopPaint = session.subscribeFrame(paint);
    const stopNotify = session.subscribe(notify);
    stopPaint();
    session.dispatch({ type: 'move', direction: 1 });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(paint).not.toHaveBeenCalled();
    stopNotify();
    session.dispatch({ type: 'move', direction: -1 });
    session.advance(0.1);
    expect(session.getState().elapsed).toBeCloseTo(0.1, 12);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(paint).not.toHaveBeenCalled();
  });
});
