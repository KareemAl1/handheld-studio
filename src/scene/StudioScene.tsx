import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, addAfterEffect, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { ConsoleModel } from './ConsoleModel';
import { CameraControls } from './CameraControls';
import type { ViewRequest } from './CameraControls';
import type { Configuration } from '../config/config';
import { SceneFallback } from '../components/SceneBoundary';

function availableWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function ContextRecovery({ onRestore }: { onRestore: () => void }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    // Three recreates GPU resources; demand rendering and one-shot captures
    // still need an explicit refresh after the context is restored.
    const restore = () => { onRestore(); invalidate(); };
    gl.domElement.addEventListener('webglcontextrestored', restore);
    return () => gl.domElement.removeEventListener('webglcontextrestored', restore);
  }, [gl, invalidate, onRestore]);
  return null;
}

function Diagnostics() {
  const { gl, camera, scene } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let frames = 0;
    let measuring = false;
    let previous = 0;
    let intervals: number[] = [];
    const unsubscribe = addAfterEffect(() => {
      frames++;
      const now = performance.now();
      if (measuring && previous) intervals.push(now - previous);
      previous = measuring ? now : 0;
    });
    window.__HS_STUDIO__ = {
      snapshot: () => ({
        frames, calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
        camera: camera.position.toArray(), zoom: camera.userData.studio, materials: scene.getObjectByName('Handheld')?.userData.materials, assembly: scene.getObjectByName('Handheld')?.userData.assembly, dpr: gl.getPixelRatio(),
        renderer: gl.getContext().getParameter(gl.getContext().RENDERER) as string,
      }),
      beginMeasure: () => { measuring = true; previous = 0; intervals = []; },
      endMeasure: () => { measuring = false; return [...intervals]; },
      poster: () => { gl.render(scene, camera); return gl.domElement.toDataURL('image/webp', 0.94); },
    };
    return () => { unsubscribe(); delete window.__HS_STUDIO__; };
  }, [gl, camera, scene]);
  return null;
}

export default function StudioScene({ config, view, assembly, onReady, onOrbit }: {
  config: Configuration; view: ViewRequest; assembly: number; onReady: () => void; onOrbit: () => void;
}) {
  const [supported] = useState(availableWebGL);
  const [loaded, setLoaded] = useState(false);
  const [shadowRevision, setShadowRevision] = useState(0);
  const progress = useRef(0);
  const handleReady = useCallback(() => { setLoaded(true); onReady(); }, [onReady]);
  const refreshShadow = useCallback(() => setShadowRevision(value => value + 1), []);
  if (!supported) return <SceneFallback unavailable />;
  return <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 32, near: 0.1, far: 60, position: [3.5, 3, 10] }}
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
    <ambientLight intensity={0.32} />
    <directionalLight position={[-3, 7, 6]} color="#fff5e6" intensity={3.1} />
    <directionalLight position={[5, 1, 3]} color="#f4f6ed" intensity={0.8} />
    <directionalLight position={[-3, 4, -6]} color="#f8f4e9" intensity={2.6} />
    <Suspense fallback={<Html center><div className="asset-loading" role="status">Preparing your handheld…</div></Html>}>
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.7} color="#fff8ea" position={[-4, 6, 5]} rotation={[0.2, 0.3, 0]} scale={[7, 5, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#e8efe9" position={[5, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[1, 5, -4]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 3, 1]} />
      </Environment>
      <ConsoleModel config={config} assembly={assembly} progress={progress} onReady={handleReady} onAssemblyRest={refreshShadow} />
      <ContactShadows renderOrder={shadowRevision} position={[0, -1.92, 0]} opacity={0.38} scale={18} blur={2.6} far={5} resolution={512} frames={1} color="#414338" />
    </Suspense>
    <CameraControls view={view} progress={progress} loaded={loaded} onOrbit={onOrbit} />
    <ContextRecovery onRestore={refreshShadow} />
    {import.meta.env.DEV && <Diagnostics />}
  </Canvas>;
}
