import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { clampZoom, fitDistance, ZOOM_LIMITS } from './framing';

export type ViewName = 'studio' | 'front' | 'back';
export type CameraCommand = ViewName | 'fit' | 'zoom-in' | 'zoom-out';
export type ViewRequest = { name: CameraCommand; revision: number };

export function CameraControls({ view, onOrbit }: { view: ViewRequest; onOrbit: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate, gl } = useThree();
  const reduced = useReducedMotion();
  const state = useRef({ zoom: 1, zoomGoal: 1, moving: false, first: true, time: 0, goal: new Spherical(), sphere: new Spherical() });

  useEffect(() => {
    const s = state.current;
    s.time = performance.now();
    if (view.name === 'zoom-in' || view.name === 'zoom-out') {
      s.zoomGoal = clampZoom(s.zoomGoal * (view.name === 'zoom-in' ? 0.82 : 1 / 0.82));
    } else {
      s.zoomGoal = 1;
      if (view.name !== 'fit') {
        const direction = view.name === 'front' ? [0, 0, 1] : view.name === 'back' ? [0, 0, -1] : [0.48, 0.38, 1];
        s.goal.setFromVector3(new Vector3(...direction as [number, number, number]));
        if (controls.current) { controls.current.enableDamping = false; controls.current.update(); }
        s.moving = true;
        if (s.first || reduced) {
          s.sphere.copy(s.goal);
          camera.position.setFromSpherical(s.sphere);
          s.moving = false;
        }
      }
    }
    if (reduced) s.zoom = s.zoomGoal;
    s.first = false;
    invalidate();
  }, [camera, view, reduced, invalidate]);

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
      if (pointers.size === 2) span = distance();
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
    const up = (event: PointerEvent) => { pointers.delete(event.pointerId); span = 0; };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.setAttribute('aria-label', 'HS–01 3D model. Drag to rotate; scroll or pinch to zoom. Accessible camera and zoom controls follow.');
    element.setAttribute('role', 'img');
    return () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
  }, [gl, size.height, invalidate, reduced]);

  useFrame(() => {
    const s = state.current;
    const now = performance.now();
    const blend = reduced ? 1 : 1 - Math.exp(-10 * Math.min((now - s.time) / 1000, 0.05));
    s.time = now;
    s.sphere.setFromVector3(camera.position);
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
    const fit = fitDistance(direction, size.width / size.height);
    s.sphere.radius = Math.max(4.4, fit * s.zoom);
    camera.position.setFromSpherical(s.sphere);
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    camera.userData.studio = { zoom: s.zoom, zoomGoal: s.zoomGoal, fit, min: ZOOM_LIMITS.min, max: ZOOM_LIMITS.max };
    if (s.moving || s.zoom !== s.zoomGoal) invalidate();
  });

  return <OrbitControls ref={controls} makeDefault target={[0, 0, 0]}
    enableZoom={false} enablePan={false} enableDamping={!reduced} dampingFactor={0.13}
    rotateSpeed={0.65} minPolarAngle={0.12} maxPolarAngle={Math.PI * 0.86}
    onStart={() => { state.current.moving = false; if (controls.current) controls.current.enableDamping = !reduced; onOrbit(); }} />;
}
