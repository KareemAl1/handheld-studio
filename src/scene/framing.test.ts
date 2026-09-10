import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { clampZoom, DEVICE_HALF_SIZE, fitDistance } from './framing';
it('keeps every corner inside Fit across aspect ratios and orbit angles', () => {
  for (const aspect of [0.55, 1, 1.8, 2.7]) for (let theta = -Math.PI; theta <= Math.PI; theta += 0.3) for (const phi of [0.12, 0.6, 1.2, 1.8, 2.7]) {
    const direction = new Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const camera = new PerspectiveCamera(32, aspect, 0.1, 100);
    camera.position.copy(direction).multiplyScalar(fitDistance(direction, aspect));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const point = new Vector3(x * DEVICE_HALF_SIZE[0], y * DEVICE_HALF_SIZE[1], z * DEVICE_HALF_SIZE[2]).project(camera);
      expect(Math.max(Math.abs(point.x), Math.abs(point.y))).toBeLessThan(0.9);
      expect(point.z).toBeLessThan(1);
    }
  }
});
it('clamps repeated zoom input without accumulating out-of-range values', () => {
  let zoom = 1;
  for (let i = 0; i < 100; i++) zoom = clampZoom(zoom * 0.82);
  expect(zoom).toBe(0.56);
  for (let i = 0; i < 100; i++) zoom = clampZoom(zoom / 0.82);
  expect(zoom).toBe(1.5);
});
