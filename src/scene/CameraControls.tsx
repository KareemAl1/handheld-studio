import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { clampZoom, fitDistance, ZOOM_LIMITS } from './framing';
import type { AssemblyPart } from './assembly';

export type ViewName = 'studio' | 'front' | 'back';
export type CameraCommand = ViewName | AssemblyPart | 'exploded' | 'fit' | 'zoom-in' | 'zoom-out';
export type ViewRequest = { name: CameraCommand; revision: number };

export function CameraControls({ view, progress, loaded, onOrbit }: { view: ViewRequest; progress: MutableRefObject<number>; loaded: boolean; onOrbit: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate, gl } = useThree();
  const reduced = useReducedMotion();
  const consumed = useRef<ViewRequest | null>(null);
  const state = useRef({ zoom: 1, zoomGoal: 1, moving: false, first: true, time: 0, goal: new Spherical(), sphere: new Spherical(), target: new Vector3(), focus: 'studio' as CameraCommand });

  useEffect(() => {
    if (!loaded) return;
    const s = state.current;
    s.time = performance.now();
    if (consumed.current === view) {
      if (reduced) {
        s.zoom = s.zoomGoal;
        if (s.moving) { camera.position.setFromSpherical(s.goal).add(s.target); s.moving = false; }
      }
      if (controls.current) controls.current.enableDamping = !reduced;
      invalidate();
      return;
    }
    consumed.current = view;
    if (view.name === 'zoom-in' || view.name === 'zoom-out') {
      s.zoomGoal = clampZoom(s.zoomGoal * (view.name === 'zoom-in' ? 0.82 : 1 / 0.82));
    } else {
      s.zoomGoal = 1;
      s.focus = view.name;
      if (view.name === 'fit') {
        s.moving = false;
        if (controls.current) controls.current.enableDamping = !reduced;
      }
      if (view.name !== 'fit') {
        const poses: Partial<Record<CameraCommand, [number,number,number]>> = {
          front: [0,0,1], back: [0,0,-1], studio: [.48,.38,1], exploded: [1.5,.65,1.1],
          'front-shell': [.25,.2,1], controls: [.25,.45,1], display: [.22,.2,1], board: [1.5,.65,1.1], 'rear-shell': [-.4,.25,-1],
        };
        const direction = poses[view.name] ?? poses.studio!;
        if (['front-shell','controls','display','board','rear-shell'].includes(view.name)) s.zoomGoal = 0.74;
        s.goal.setFromVector3(new Vector3(...direction as [number, number, number]));
        if (controls.current) { controls.current.enableDamping = false; controls.current.update(); }
        s.moving = true;
        if (s.first || reduced) {
          s.sphere.copy(s.goal);
          if (s.first && !reduced) { s.sphere.theta += 0.1; s.sphere.phi -= 0.05; s.zoom = 1.04; }
          camera.position.setFromSpherical(s.sphere).add(s.target);
          s.moving = !reduced;
        }
      }
    }
    if (reduced) s.zoom = s.zoomGoal;
    s.first = false;
    invalidate();
  }, [camera, view, loaded, reduced, invalidate]);

  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map<number, [number, number]>();
    let span = 0;
    const changeZoom = (factor: number) => {
      const s = state.current;
      s.zoomGoal = clampZoom(s.zoomGoal * factor);
      s.time = performance.now();
      if (reduced) s.zoom = s.zoomGoal;
      invalidate();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
      changeZoom(Math.exp(MathUtils.clamp(event.deltaY * unit, -120, 120) * (event.ctrlKey ? 0.012 : 0.0025)));
    };
    const distance = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 2) {
        span = distance();
        // OrbitControls otherwise retains the previous one-finger rotate state.
        if (controls.current) controls.current.enabled = false;
      }
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 2) {
        const next = distance();
        if (span > 0 && next > 0) changeZoom(span / next);
        span = next;
      }
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId); span = 0;
      if (pointers.size === 0 && controls.current) controls.current.enabled = loaded;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.setAttribute('aria-label', 'HS–01 3D model. Drag to rotate; scroll or pinch to zoom. Accessible camera and zoom controls follow.');
    element.setAttribute('role', 'img');
    element.tabIndex = -1;
    return () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }, [gl, size.height, invalidate, reduced, loaded]);

  useFrame(() => {
    if (!loaded) return;
    const s = state.current;
    const now = performance.now();
    const blend = reduced ? 1 : 1 - Math.exp(-10 * Math.min((now - s.time) / 1000, 0.05));
    s.time = now;
    s.sphere.setFromVector3(camera.position.clone().sub(s.target));
    if (s.moving) {
      const angle = MathUtils.euclideanModulo(s.goal.theta - s.sphere.theta + Math.PI, Math.PI * 2) - Math.PI;
      s.sphere.theta += angle * blend;
      s.sphere.phi = MathUtils.lerp(s.sphere.phi, s.goal.phi, blend);
      if (Math.abs(angle) + Math.abs(s.goal.phi - s.sphere.phi) < 0.0001) {
        s.sphere.theta = s.goal.theta; s.sphere.phi = s.goal.phi; s.moving = false;
        if (controls.current) controls.current.enableDamping = !reduced;
      }
    }
    s.zoom = MathUtils.lerp(s.zoom, s.zoomGoal, blend);
    if (Math.abs(s.zoom - s.zoomGoal) < 0.00005) s.zoom = s.zoomGoal;
    const direction = new Vector3().setFromSpherical(s.sphere).normalize();
    const a = progress.current;
    const targets: Partial<Record<CameraCommand, [number,number,number]>> = {
      'front-shell':[0,0,2.6*a], controls:[2.25,.25,.44+1.7*a], display:[0,.16,.4+.6*a], board:[0,0,-.65*a], 'rear-shell':[0,0,-.35-2.4*a],
    };
    const goalTarget = new Vector3(...(targets[s.focus] ?? [0,0,0]));
    s.target.lerp(goalTarget, blend);
    if (s.target.distanceToSquared(goalTarget) < 0.000001) s.target.copy(goalTarget);
    const halfSize = [3.24,1.81,.51+2.6*a];
    const fit = fitDistance(direction, size.width / size.height, halfSize, s.target);
    // Even at maximum inspection zoom the eye stays outside the complete assembly.
    s.sphere.radius = Math.max(Math.hypot(...halfSize) + s.target.length() + 0.45, fit * s.zoom);
    camera.position.setFromSpherical(s.sphere).add(s.target);
    camera.lookAt(s.target);
    controls.current?.target.copy(s.target);
    controls.current?.update();
    camera.userData.studio = { zoom: s.zoom, zoomGoal: s.zoomGoal, fit, target: s.target.toArray(), min: ZOOM_LIMITS.min, max: ZOOM_LIMITS.max };
    if (s.moving || s.zoom !== s.zoomGoal || !s.target.equals(goalTarget)) invalidate();
  });

  return <OrbitControls ref={controls} makeDefault enabled={loaded}
    enableZoom={false} enablePan={false} enableDamping={!reduced} dampingFactor={0.13}
    rotateSpeed={0.65} minPolarAngle={0.12} maxPolarAngle={Math.PI * 0.86}
    onStart={() => { state.current.moving = false; if (controls.current) controls.current.enableDamping = !reduced; onOrbit(); }} />;
}
