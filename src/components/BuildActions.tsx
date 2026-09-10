import { useRef, useState } from 'react';
import type { Configuration } from '../config/config';
import { serializeConfig } from '../config/config';
import { makeShareUrl, readSavedBuild, writeSavedBuild } from '../config/persistence';

export function BuildActions({ config, initialMessage, onRestore }: {
  config: Configuration; initialMessage?: string; onRestore: (config: Configuration) => void;
}) {
  const [message, setMessage] = useState(initialMessage ?? 'Save one build in this browser, or share your exact colors.');
  const [shared, setShared] = useState<{ encoded: string; url: string } | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const visibleLink = shared?.encoded === serializeConfig(config) ? shared.url : '';
  const clearSharedQuery = () => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  };
  const save = () => {
    const result = writeSavedBuild(config, () => window.localStorage);
    if (result.status === 'saved') { clearSharedQuery(); setMessage('Build saved in this browser.'); }
    else setMessage(result.message);
  };
  const restore = () => {
    const result = readSavedBuild(() => window.localStorage);
    if (result.status === 'saved') { onRestore(result.config); clearSharedQuery(); setMessage('Saved build restored.'); }
    else setMessage(result.status === 'empty' ? 'No saved build yet. Choose your colors, then Save build.' : result.message);
  };
  const share = async () => {
    const url = makeShareUrl(config, window.location.href);
    setShared({encoded:serializeConfig(config),url});
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setMessage('Share link copied.');
    } catch {
      setMessage('Clipboard unavailable. Select and copy the link below.');
      requestAnimationFrame(() => { linkInput.current?.focus(); linkInput.current?.select(); });
    }
  };
  return <section className="build-actions" aria-label="Keep and share your build">
    <div className="build-actions-heading"><div><span className="eyebrow">YOUR PERSONAL EDITION</span><h2>Keep this one<span>.</span></h2></div><p>Your colors. Ready for another day.</p></div>
    <div className="build-action-buttons"><button onClick={save}>Save build <span aria-hidden="true">↓</span></button><button onClick={restore}>Restore saved <span aria-hidden="true">↶</span></button><button onClick={() => void share()}>Copy share link <span aria-hidden="true">↗</span></button></div>
    <p className="build-feedback" role="status" aria-live="polite" data-testid="build-feedback">{message}</p>
    {visibleLink && <label className="share-link">Share link<input ref={linkInput} aria-label="Share link" type="url" readOnly value={visibleLink} onFocus={event => event.currentTarget.select()} /></label>}
    <p className="local-link-note">Localhost links only work locally until deployment.</p>
  </section>;
}
