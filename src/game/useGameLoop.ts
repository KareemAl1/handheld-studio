import { useEffect, useSyncExternalStore } from 'react';
import type { GameSession } from './session';

export function useGameLoop(session: GameSession, playing: boolean) {
  const summary = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    if (!playing) return;
    const pause = () => { if (document.hidden) session.dispatch({ type: 'pause' }); };
    document.addEventListener('visibilitychange', pause);
    pause();
    return () => document.removeEventListener('visibilitychange', pause);
  }, [playing, session]);
  useEffect(() => {
    if (!playing || summary.phase !== 'running') return;
    if (document.hidden) { session.dispatch({ type: 'pause' }); return; }
    let previous = performance.now();
    let request = 0;
    const frame = (now: number) => {
      if (document.hidden || session.getState().phase !== 'running') return;
      // At most 30 texture uploads/second; simulation steps stay at 60/second.
      if (now - previous >= 1000 / 30) { session.advance((now - previous) / 1000); previous = now; }
      request = requestAnimationFrame(frame);
    };
    request = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(request);
  }, [playing, session, summary.phase]);
  return summary;
}
