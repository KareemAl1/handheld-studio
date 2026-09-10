import { expect, it } from 'vitest';
import { ASSEMBLY_PARTS, assemblyOffset, clampAssembly } from './assembly';
import { fitDistance } from './framing';
import { PerspectiveCamera, Vector3 } from 'three';
it('uses absolute layer positions with exact reassembly after repeated partial reversals', () => {
  for(let cycle=0;cycle<50;cycle++) for(const amount of [0,1,.3,.95,.1,0]) {
    const positions = ASSEMBLY_PARTS.map(part => assemblyOffset(part.id, amount));
    if (amount === 0) expect(positions.every(value => value === 0)).toBe(true);
    else for(let i=1;i<positions.length;i++) expect(positions[i-1]).toBeGreaterThan(positions[i]);
  }
  expect(clampAssembly(-1)).toBe(0); expect(clampAssembly(3)).toBe(1); expect(clampAssembly(NaN)).toBe(0);
});
it('fits every exploded layer corner without entering the device', () => {
  for(const aspect of [.65,1.8]) for(const amount of [0,.5,1]) for(const direction of [new Vector3(0,0,1),new Vector3(.8,.35,1).normalize(),new Vector3(0,.2,-1).normalize()]) {
    const halfSize = [3.24,1.81,.51+2.6*amount];
    const camera = new PerspectiveCamera(32,aspect,.1,100);
    camera.position.copy(direction).multiplyScalar(fitDistance(direction,aspect,halfSize));
    camera.lookAt(0,0,0); camera.updateMatrixWorld();
    for(const part of ASSEMBLY_PARTS) for(const x of [-3.24,3.24]) for(const y of [-1.81,1.81]) for(const z of [-.51,.51]) {
      const point = new Vector3(x,y,z+assemblyOffset(part.id,amount)).project(camera);
      expect(Math.max(Math.abs(point.x),Math.abs(point.y))).toBeLessThan(.9);
      expect(point.z).toBeGreaterThan(-1);
    }
  }
});
