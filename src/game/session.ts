import { createGame, updateGame } from './engine';
import type { GameAction, GameState } from './engine';
import { readBestScore, recordScore } from './bestScore';
import type { StorageAccess } from '../config/persistence';

export type GameSummary = Pick<GameState, 'phase' | 'score' | 'lane'> & { best: number; newBest: boolean };

// Gameplay changes at a fixed timestep; React subscribes only to HUD changes.
export class GameSession {
  private state: GameState = createGame();
  private best: number;
  private newBest = false;
  private summary: GameSummary;
  private accumulator = 0;
  private listeners = new Set<() => void>();
  private painters = new Set<() => void>();
  private readonly getStorage: StorageAccess;

  // Without storage the best score lives only for this session.
  constructor({ getStorage = () => null }: { getStorage?: StorageAccess } = {}) {
    this.getStorage = getStorage;
    this.best = readBestScore(getStorage);
    this.summary = this.summarize(this.state);
  }

  getState = () => this.state;
  getSnapshot = () => this.summary;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeFrame = (listener: () => void) => { this.painters.add(listener); return () => { this.painters.delete(listener); }; };

  private summarize(state: GameState): GameSummary {
    return { phase: state.phase, score: state.score, lane: state.lane, best: this.best, newBest: this.newBest };
  }

  private publish(next: GameState) {
    if (next === this.state) return;
    // A run is recorded once, on the transition into game over.
    if (next.phase === 'over' && this.state.phase !== 'over') {
      const record = recordScore(next.score, this.best, this.getStorage);
      this.best = record.best;
      this.newBest = record.isNew;
    } else if (next.phase !== 'over') {
      this.newBest = false;
    }
    this.state = next;
    const { summary } = this;
    if (next.phase !== summary.phase || next.score !== summary.score || next.lane !== summary.lane
      || this.best !== summary.best || this.newBest !== summary.newBest) {
      this.summary = this.summarize(next);
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
