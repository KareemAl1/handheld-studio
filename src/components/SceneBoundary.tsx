import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export function SceneFallback({ unavailable = false, moduleFailed = false, onRetry }: { unavailable?: boolean; moduleFailed?: boolean; onRetry?: () => void }) {
  return <div className="scene-fallback" role="status">
    <img src="/images/hs-01-poster.webp" alt="HS–01 handheld in its default Chalk shell" />
    <div className="fallback-message">
      <strong>{unavailable ? '3D view unavailable' : moduleFailed ? 'The viewer couldn’t load' : 'The device couldn’t load'}</strong>
      <p>{unavailable ? 'Your browser could not start WebGL. You can still choose a shell. Preview shown in Chalk.' : moduleFailed ? 'Reload this page to fetch the studio again.' : 'Check your connection and try again. Your shell selection is kept.'}</p>
      {moduleFailed ? <button className="text-button" onClick={() => window.location.reload()}>Reload page</button> : onRetry && <button className="text-button" onClick={onRetry}>Retry 3D view</button>}
    </div>
  </div>;
}

export class SceneBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean; moduleFailed: boolean }> {
  state = { failed: false, moduleFailed: false };
  static getDerivedStateFromError(error: Error) { return { failed: true, moduleFailed: error.name === 'ViewerModuleError' }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Preserve the original import error and its cause for network diagnosis.
    console.error('Handheld viewer failed:', error, info.componentStack);
  }
  render() {
    return this.state.failed ? <SceneFallback moduleFailed={this.state.moduleFailed} onRetry={this.props.onRetry} /> : this.props.children;
  }
}
