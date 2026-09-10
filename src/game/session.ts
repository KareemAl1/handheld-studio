import { createGame, updateGame } from './engine';
import type { GameAction, GameState } from './engine';

type Summary = Pick<GameState, 'phase' | 'score' | 'lane'>;

// Gameplay changes at a fixed timestep; React subscribes only to HUD changes.
export class GameSession {
  private state = createGame();
  private summary: Summary = { phase: this.state.phase, score: this.state.score, lane: this.state.lane };
  private accumulator = 0;
  private listeners = new Set<() => void>();
  private painters = new Set<() => void>();
  getState = () => this.state;
  getSnapshot = () => this.summary;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeFrame = (listener: () => void) => { this.painters.add(listener); return () => { this.painters.delete(listener); }; };
  private publish(next: GameState) {
    if (next === this.state) return;
    this.state = next;
    if (next.phase !== this.summary.phase || next.score !== this.summary.score || next.lane !== this.summary.lane) {
      this.summary = { phase: next.phase, score: next.score, lane: next.lane };
      this.listeners.forEach(listener => listener());
    }
    this.painters.forEach(paint => paint());
  }
  reset = () => { this.accumulator = 0; this.publish(createGame()); };
  dispatch = (action: GameAction) => {
    if (action.type !== 'tick' && action.type !== 'move') this.accumulator = 0;
    this.publish(updateGame(this.state, action));
  };
  advance = (seconds: number) => {
    if (this.state.phase !== 'running' || !Number.isFinite(seconds) || seconds <= 0) return;
    this.accumulator += Math.min(seconds, .1);
    let next = this.state;
    while (this.accumulator + 1e-9 >= 1 / 60) {
      next = updateGame(next, { type: 'tick', seconds: 1 / 60 });
      this.accumulator = Math.max(0, this.accumulator - 1 / 60);
    }
    this.publish(next);
  };
}
