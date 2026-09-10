import type { GameState } from '../game/engine';
import type { GameSession } from '../game/session';

export function GamePanel({ session, summary, ready, onExit }: {
  session: GameSession; summary: Pick<GameState, 'phase' | 'score' | 'lane'>; ready: boolean; onExit: () => void;
}) {
  const { phase, score } = summary;
  const action = phase === 'ready' ? 'start' : phase === 'over' ? 'restart' : phase === 'paused' ? 'resume' : 'pause';
  const label = { start: 'Start game', restart: 'Restart game', resume: 'Resume game', pause: 'Pause game' }[action];
  return <div className="game-panel" data-phase={phase} data-lane={summary.lane}>
    <div className="game-heading"><div><span className="eyebrow">ONE SMALL GAME</span><h2>Signal Run<span>.</span></h2></div><button className="exit-play" onClick={onExit}>Exit Play <span aria-hidden="true">↗</span></button></div>
    <div className="game-scoreline" role="status" aria-live="polite"><span>{!ready ? 'Framing the screen…' : phase === 'ready' ? 'Ready when you are.' : phase === 'running' ? 'Collect signals. Dodge obstacles.' : phase === 'over' ? 'Game over. Another run?' : 'Paused. Resume when you’re ready.'}</span><span>Score <strong data-testid="game-score">{score}</strong></span></div>
    <div className="game-controls" role="group" aria-label="Signal Run controls">
      <button className="game-direction" aria-label="Move left" disabled={phase !== 'running'} onClick={() => session.dispatch({type:'move',direction:-1})}><span aria-hidden="true">←</span></button>
      <button className="game-action" disabled={!ready} onClick={() => session.dispatch({type:action})}>{label}</button>
      <button className="game-direction" aria-label="Move right" disabled={phase !== 'running'} onClick={() => session.dispatch({type:'move',direction:1})}><span aria-hidden="true">→</span></button>
    </div>
    <p className="game-instructions">← → or A / D to move. Enter to start. Escape to exit.<br />On touch, tap the arrows. Orange diamonds score; crossed blocks end your run.</p>
  </div>;
}
