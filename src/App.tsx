import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Configurator } from './components/Configurator';
import { SceneBoundary } from './components/SceneBoundary';
import { DetailViews } from './components/DetailViews';
import type { AssemblyPart } from './scene/assembly';
import { configReducer, DEFAULT_CONFIG, isShellColor, validateConfig } from './config/config';
import type { ShellColor } from './config/config';
import type { CameraCommand, ViewName, ViewRequest } from './scene/CameraControls';

const StudioScene = lazy(() => import('./scene/StudioScene').catch((cause: unknown) => {
  const error = new Error('The 3D viewer module could not load.', { cause });
  error.name = 'ViewerModuleError';
  throw error;
}));
const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'studio', label: 'Studio' }, { id: 'front', label: 'Front' }, { id: 'back', label: 'Back' },
];

export default function App() {
  const [currentConfig, dispatch] = useReducer(configReducer, DEFAULT_CONFIG);
  // A hot refresh can preserve an older schema in React's in-memory state.
  const config = useMemo(() => validateConfig(currentConfig) ?? DEFAULT_CONFIG, [currentConfig]);
  const [view, setView] = useState<ViewRequest>({ name: 'studio', revision: 0 });
  const [activeView, setActiveView] = useState<ViewName | null>('studio');
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [assembly, setAssembly] = useState(0);
  const [detail, setDetail] = useState<AssemblyPart | null>(null);
  const selectShell = useCallback((shell: ShellColor) => dispatch({ type: 'select-shell', shell }), []);
  const chooseView = useCallback((name: ViewName) => {
    setDetail(null);
    setActiveView(name);
    setView((previous) => ({ name, revision: previous.revision + 1 }));
  }, []);
  const resetBuild = () => { dispatch({ type: 'reset' }); setAssembly(0); chooseView('studio'); };
  const zoom = (name: CameraCommand) => {
    if (name === 'fit') { setDetail(null); setActiveView(null); }
    setView((previous) => ({ name, revision: previous.revision + 1 }));
  };
  const explode = () => { setAssembly(1); setDetail(null); setActiveView(null); zoom('exploded'); };
  const selectDetail = (part: AssemblyPart, keyboard: boolean) => {
    setDetail(part); setActiveView(null);
    if (part === 'board') setAssembly(1);
    zoom(part);
    if (keyboard) document.querySelector('canvas')?.focus({ preventScroll: true });
    document.querySelector('.viewer')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const retry = async () => {
    const { useGLTF } = await import('@react-three/drei');
    useGLTF.clear('/models/hs-01.glb');
    setReady(false);
    setAttempt((count) => count + 1);
  };
  const onReady = useCallback(() => setReady(true), []);
  const onOrbit = useCallback(() => setActiveView(null), []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'configure_handheld_shell',
        description: 'Select the shell color of the visible HS–01 build. Changes only this page’s current configuration.',
        inputSchema: { type: 'object', properties: { shell: { type: 'string', enum: ['chalk', 'graphite', 'ember'] } }, required: ['shell'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input: unknown) {
          if (!input || typeof input !== 'object' || Object.keys(input).length !== 1 || !('shell' in input) || !isShellColor(input.shell)) throw new TypeError('Choose chalk, graphite, or ember.');
          selectShell(input.shell);
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          return { shell: input.shell, version: 1 };
        },
      }, { signal: lifecycle.signal })).catch(() => { /* Optional browser capability. */ });
    } catch { /* Unsupported experimental API must not affect the configurator. */ }
    return () => lifecycle.abort();
  }, [selectShell]);

  return <div className="studio-app">
    <a className="skip-link" href="#customize">Skip to customization</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Handheld Studio home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>handheld<span className="brand-second">studio</span></span>
      </a>
      <div className="header-note"><span className="small-cross" aria-hidden="true">+</span> INDEPENDENT OBJECTS OF PLAY</div>
      <span className="project-index">VOL. 001 <span>—</span> 2026</span>
    </header>

    <main>
      <div className="workbench-title">
        <div><p className="eyebrow">THE HANDHELD STUDIO</p><h1>Make it yours<span>.</span></h1></div>
        <p className="title-note">A familiar object.<br />A new point of view.</p>
      </div>
      <div className="workbench">
        <section className="viewer" aria-label="Interactive HS–01 device viewer">
          <div className="viewer-topline"><span><span className="orange-square" /> HS–01</span><span>164 × 88 × 19 MM</span></div>
          <div className="scene-wrap" data-testid="device-viewer" data-ready={ready}>
            <SceneBoundary key={attempt} onRetry={retry}>
              <Suspense fallback={<div className="loading-state" role="status"><span className="loading-orbit" />Preparing your handheld…</div>}>
                <StudioScene config={config} view={view} assembly={assembly} onReady={onReady} onOrbit={onOrbit} />
              </Suspense>
            </SceneBoundary>
          </div>
          <div className="viewer-toolbar">
            <div className="zoom-controls" role="group" aria-label="Viewer zoom">
              <button aria-label="Zoom out" onClick={() => zoom('zoom-out')}>−</button>
              <button onClick={() => zoom('fit')}>Fit</button>
              <button aria-label="Zoom in" onClick={() => zoom('zoom-in')}>+</button>
            </div>
            <div className="view-controls" role="group" aria-label="Device camera view">
              {VIEWS.map(({ id, label }) => <button key={id} aria-pressed={activeView === id} onClick={() => chooseView(id)}>{label}</button>)}
            </div>
          </div>
          <p className="viewer-help">Drag to rotate · Scroll or pinch to zoom</p>
          <div className="assembly-panel">
            <div className="assembly-heading"><span><span className="orange-square" /> Inside the HS–01</span><div className="assembly-actions"><button onClick={explode} aria-pressed={assembly === 1}>Explode</button><button onClick={() => { setAssembly(0); chooseView('studio'); }}>Assemble</button></div></div>
            <label className="assembly-slider"><span>Assembly</span><input type="range" min="0" max="100" step="1" value={Math.round(assembly*100)} onChange={(event) => setAssembly(Number(event.target.value)/100)} aria-valuetext={`${Math.round(assembly*100)} percent exploded`} /><output>{Math.round(assembly*100)}%</output></label>
          </div>
        </section>
        <div id="customize"><Configurator config={config} onShell={selectShell} onButtons={(buttons) => dispatch({ type: 'select-buttons', buttons })} onFinish={(finish) => dispatch({ type: 'select-finish', finish })} onReset={resetBuild} /></div>
      </div>
      <div className="workbench-caption"><span><span className="caption-symbol" aria-hidden="true">↳</span> Designed to be held. Made to be personal.</span><span>ORIGINAL HARDWARE CONCEPT / HS–01</span></div>
      <DetailViews selected={detail} onSelect={selectDetail} />
    </main>
    <footer className="site-footer"><span>An independent study by <strong>Kareem Alwan</strong></span><span className="footer-wordmark">GOOD THINGS. SMALL FORM.</span></footer>
  </div>;
}
