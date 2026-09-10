import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Spherical, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type ViewName = 'studio' | 'front' | 'back';
export type ViewRequest = { name: ViewName; revision: number };

export function CameraControls({ view, onOrbit }: { view: ViewRequest; onOrbit: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate, gl } = useThree();
  const goal = useRef(new Vector3());
  const sphere = useRef(new Spherical());
  const goalSphere = useRef(new Spherical());
  const lastAnimationTime = useRef(0);
  const moving = useRef(false);
  const first = useRef(true);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const aspect = size.width / size.height;
    const distance = Math.max(4.35 / 2, 7.4 / (2 * aspect)) / Math.tan(MathUtils.degToRad(32 / 2)) * 1.10;
    const direction = view.name === 'front' ? [0, 0, 1] : view.name === 'back' ? [0, 0, -1] : [0.48, 0.38, 1];
    goal.current.set(...direction as [number, number, number]).normalize().multiplyScalar(distance);
    goalSphere.current.setFromVector3(goal.current);
    lastAnimationTime.current = performance.now();
    // Cancel any residual user-orbit damping before applying a preset.
    if (controls.current) {
      controls.current.enableDamping = false;
      controls.current.update();
    }
    if (reducedMotion || first.current) {
      camera.position.copy(goal.current);
      camera.lookAt(0, 0, 0);
      controls.current?.update();
      moving.current = false;
      first.current = false;
      if (controls.current) controls.current.enableDamping = !reducedMotion;
    } else moving.current = true;
    invalidate();
  }, [camera, size.width, size.height, view, reducedMotion, invalidate]);

  useFrame(() => {
    if (!moving.current) return;
    // Use a transition-local clock: a demand loop's first delta includes idle time.
    const now = performance.now();
    const delta = Math.min((now - lastAnimationTime.current) / 1000, 0.05);
    lastAnimationTime.current = now;
    const blend = 1 - Math.exp(-8 * delta);
    sphere.current.setFromVector3(camera.position);
    const angle = MathUtils.euclideanModulo(goalSphere.current.theta - sphere.current.theta + Math.PI, Math.PI * 2) - Math.PI;
    sphere.current.theta += angle * blend;
    sphere.current.phi = MathUtils.lerp(sphere.current.phi, goalSphere.current.phi, blend);
    sphere.current.radius = MathUtils.lerp(sphere.current.radius, goalSphere.current.radius, blend);
    camera.position.setFromSpherical(sphere.current);
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    if (camera.position.distanceToSquared(goal.current) < 0.000005) {
      camera.position.copy(goal.current);
      controls.current?.update();
      moving.current = false;
      if (controls.current) controls.current.enableDamping = !reducedMotion;
    } else invalidate();
  });

  useEffect(() => {
    const element = gl.domElement;
    element.setAttribute('aria-label', 'HS–01 3D model. Drag to rotate; use the Studio, Front, and Back buttons for keyboard inspection.');
    element.setAttribute('role', 'img');
  }, [gl]);

  return <OrbitControls ref={controls} makeDefault target={[0, 0, 0]}
    enableZoom={false} enablePan={false} enableDamping={!reducedMotion} dampingFactor={0.13}
    rotateSpeed={0.65} minPolarAngle={0.2} maxPolarAngle={Math.PI * 0.56}
    onStart={() => { moving.current = false; if (controls.current) controls.current.enableDamping = !reducedMotion; onOrbit(); }} />;
}
