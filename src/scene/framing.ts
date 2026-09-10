import { Vector3 } from 'three';
export const ZOOM_LIMITS = { min: 0.56, max: 1.5 } as const;
export const DEVICE_HALF_SIZE = [3.24, 1.81, 0.51] as const;
// Solve the perspective-frustum inequalities for every bounding-box corner.
// Includes depth and orientation, unlike fitting only the front face.
export function fitDistance(direction: Vector3, aspect: number, halfSize: readonly number[] = DEVICE_HALF_SIZE, target = new Vector3()) {
  const forward = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize();
  const up = new Vector3().crossVectors(forward, right);
  const vertical = Math.tan(16 * Math.PI / 180);
  const horizontal = vertical * Math.max(aspect, 0.1);
  let distance = 0;
  for (const x of [-halfSize[0], halfSize[0]]) for (const y of [-halfSize[1], halfSize[1]]) for (const z of [-halfSize[2], halfSize[2]]) {
    const corner = new Vector3(x, y, z).sub(target);
    distance = Math.max(distance, corner.dot(forward) + 1.14 * Math.max(Math.abs(corner.dot(right)) / horizontal, Math.abs(corner.dot(up)) / vertical));
  }
  return Math.max(distance, 5);
}
export function clampZoom(value: number) { return Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, value)); }
