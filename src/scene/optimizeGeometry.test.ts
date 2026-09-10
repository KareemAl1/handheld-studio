import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Group, Int16BufferAttribute, InterleavedBufferAttribute, LoadingManager, Matrix3, Mesh, MeshStandardMaterial, PlaneGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import type { Material, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSEMBLY_PARTS } from './assembly';
import { batchAssemblyGeometry } from './optimizeGeometry';

const meshesOf = (object: Object3D) => {
  const meshes: Mesh[] = [];
  object.traverse(child => { if (child instanceof Mesh) meshes.push(child); });
  return meshes;
};
const trianglesOf = (object: Object3D, visibleOnly = false) => {
  let triangles = 0;
  const visit = (child: Object3D) => {
    if (child instanceof Mesh) triangles += (child.geometry.index?.count ?? child.geometry.getAttribute('position').count) / 3;
  };
  if (visibleOnly) object.traverseVisible(visit); else object.traverse(visit);
  return triangles;
};
const expectBounds = (actual: Object3D, reference: Object3D) => {
  const a = new Box3().setFromObject(actual, true);
  const b = new Box3().setFromObject(reference, true);
  for (const edge of ['min', 'max'] as const) for (const axis of ['x', 'y', 'z'] as const) {
    expect(a[edge][axis]).toBeCloseTo(b[edge][axis], 5);
  }
};
const isInternal = (mesh: Mesh) =>
  (mesh.userData.assembly === 'board' && !/^(USB|Speaker)/.test(mesh.name))
  || /^(CircuitBoard|InternalFrame|Battery|Chip|Contact|Mount)/.test(mesh.name);

describe('batching the shipped handheld asset', () => {
  let source: Group;
  beforeAll(async () => {
    const manager = new LoadingManager();
    manager.setURLModifier(url => { throw new Error(`The self-contained GLB unexpectedly requested ${url}`); });
    const bytes = readFileSync(new URL('../../public/models/hs-01.glb', import.meta.url));
    source = (await new GLTFLoader(manager).parseAsync(new Uint8Array(bytes).buffer, '')).scene;
  });
  afterAll(() => {
    const meshes = meshesOf(source);
    new Set(meshes.map(mesh => mesh.geometry)).forEach(geometry => geometry.dispose());
    new Set(meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])).forEach(material => material.dispose());
  });

  it('reduces mesh submissions while preserving triangles, world bounds and all five moving layers', () => {
    const instance = source.clone(true);
    const reference = source.clone(true);
    for (const object of [instance, reference]) {
      object.position.set(4, -2, 7);
      object.rotation.set(0.12, 0.3, -0.18);
      object.scale.set(1.2, 0.8, 1.3);
    }
    const roots = ASSEMBLY_PARTS.map(part => instance.getObjectByName(part.node)!);
    expect(roots.every(Boolean)).toBe(true);
    const transforms = roots.map(root => ({ parent: root.parent, position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() }));
    const originalCount = meshesOf(instance).length;
    const result = batchAssemblyGeometry(instance, new Set(meshesOf(instance).filter(isInternal)));
    expect(result.geometries.length).toBeGreaterThan(0);
    expect(meshesOf(instance).length).toBeLessThan(originalCount);
    expect(trianglesOf(instance)).toBe(trianglesOf(reference));
    expectBounds(instance, reference);
    for (const [index, part] of ASSEMBLY_PARTS.entries()) {
      const root = instance.getObjectByName(part.node)!;
      const expected = reference.getObjectByName(part.node)!;
      expect(root).toBe(roots[index]);
      expect(root.parent).toBe(transforms[index].parent);
      expect(root.position.equals(transforms[index].position)).toBe(true);
      expect(root.quaternion.equals(transforms[index].quaternion)).toBe(true);
      expect(root.scale.equals(transforms[index].scale)).toBe(true);
      expect(trianglesOf(root)).toBe(trianglesOf(expected));
      root.position.z += part.offset;
      expected.position.z += part.offset;
      expectBounds(root, expected);
    }
    expectBounds(instance, reference);
    result.geometries.forEach(geometry => geometry.dispose());
  });

  it('leaves cached source buffers and materials intact, and returns independently disposable buffers', () => {
    const sourceMeshes = meshesOf(source);
    const sourceGeometries = [...new Set(sourceMeshes.map(mesh => mesh.geometry))];
    const sourceMaterials = [...new Set(sourceMeshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))];
    const snapshots = sourceGeometries.map(geometry => ({
      geometry,
      attributes: Object.entries(geometry.attributes).map(([name, attribute]) => {
        const array = attribute instanceof InterleavedBufferAttribute ? attribute.data.array : attribute.array;
        return { name, attribute, array, contents: array.slice() };
      }),
      index: geometry.index,
      indices: geometry.index?.array.slice(),
      groups: structuredClone(geometry.groups),
      drawRange: { ...geometry.drawRange },
      box: geometry.boundingBox?.clone() ?? null,
      sphere: geometry.boundingSphere?.clone() ?? null,
    }));
    const materials = sourceMaterials.map(material => ({ material, json: JSON.stringify(material.toJSON()), version: material.version }));
    const sourceDisposed = vi.fn();
    [...sourceGeometries, ...sourceMaterials].forEach(resource => resource.addEventListener('dispose', sourceDisposed));
    const instance = source.clone(true);
    const result = batchAssemblyGeometry(instance, new Set(meshesOf(instance).filter(isInternal)));
    const liveGeometries = new Set(meshesOf(instance).map(mesh => mesh.geometry));
    const sourceArrays = new Set(snapshots.flatMap(snapshot => snapshot.attributes.map(attribute => attribute.array.buffer)));
    expect(new Set(result.geometries).size).toBe(result.geometries.length);
    for (const geometry of result.geometries) {
      expect(liveGeometries.has(geometry)).toBe(true);
      expect(sourceGeometries.includes(geometry)).toBe(false);
      for (const attribute of Object.values(geometry.attributes)) {
        const array = attribute instanceof InterleavedBufferAttribute ? attribute.data.array : attribute.array;
        expect(sourceArrays.has(array.buffer)).toBe(false);
      }
      geometry.dispose();
    }
    expect(sourceDisposed).not.toHaveBeenCalled();
    for (const snapshot of snapshots) {
      expect(Object.keys(snapshot.geometry.attributes)).toEqual(snapshot.attributes.map(attribute => attribute.name));
      for (const attribute of snapshot.attributes) {
        expect(snapshot.geometry.getAttribute(attribute.name)).toBe(attribute.attribute);
        expect(attribute.array).toEqual(attribute.contents);
      }
      expect(snapshot.geometry.index).toBe(snapshot.index);
      expect(snapshot.geometry.index?.array).toEqual(snapshot.indices);
      expect(snapshot.geometry.groups).toEqual(snapshot.groups);
      expect(snapshot.geometry.drawRange).toEqual(snapshot.drawRange);
      expect(snapshot.geometry.boundingBox).toEqual(snapshot.box);
      expect(snapshot.geometry.boundingSphere).toEqual(snapshot.sphere);
    }
    for (const { material, json, version } of materials) {
      expect(JSON.stringify(material.toJSON())).toBe(json);
      expect(material.version).toBe(version);
    }
    [...sourceGeometries, ...sourceMaterials].forEach(resource => resource.removeEventListener('dispose', sourceDisposed));
  });
});

function syntheticFixture() {
  const instance = new Group();
  const front = new Group(); front.name = 'AssemblyFrontShell';
  const rear = new Group(); rear.name = 'AssemblyRearShell';
  instance.add(front, rear);
  instance.position.set(2, -1, 4); instance.rotation.set(0.2, 0.4, -0.1);
  front.position.set(1, 2, 3); front.rotation.set(0.1, -0.3, 0.2); front.scale.set(1.2, 0.7, 1.4);
  rear.position.z = -3;
  const nested = new Group(); nested.position.set(-2, 1, 0.5); nested.rotation.z = 0.2; front.add(nested);
  const material = new MeshStandardMaterial({ name: 'Shared' });
  const sameNameDifferentMaterial = material.clone();
  const plane = new PlaneGeometry(2, 1);
  const add = (name: string, parent: Object3D, selected: Material | Material[] = material, geometry: BufferGeometry = plane) => {
    const mesh = new Mesh(geometry, selected); mesh.name = name; mesh.position.x = parent.children.length * 3;
    parent.add(mesh); return mesh;
  };
  const outside = [add('OutsideA', nested), add('OutsideB', nested, material, plane.toNonIndexed())];
  outside[1].scale.x = -1;
  outside[1].geometry.deleteAttribute('normal'); outside[1].geometry.deleteAttribute('uv');
  const inside = [add('InsideA', nested), add('InsideB', nested)];
  const distinct = [add('DistinctA', front, sameNameDifferentMaterial), add('DistinctB', front, sameNameDifferentMaterial)];
  const rearMeshes = [add('RearA', rear), add('RearB', rear)];
  const arrayMaterial = add('ArrayMaterial', front, [material]);
  const singleton = add('Singleton', front, material.clone());
  const hiddenGroup = new Group(); hiddenGroup.visible = false; front.add(hiddenGroup);
  const hidden = [add('HiddenA', hiddenGroup), add('HiddenB', hiddenGroup)];
  const conditional = new Set([...inside, arrayMaterial, singleton]);
  return { instance, front, rear, outside, inside, distinct, rearMeshes, arrayMaterial, singleton, hiddenGroup, hidden, conditional, material, plane };
}

it('keeps material identities, conditional visibility and assembly membership separate while retaining fallbacks', () => {
  const fixture = syntheticFixture();
  const originalConditional = [...fixture.conditional];
  const beforeVisible = trianglesOf(fixture.instance, true);
  const result = batchAssemblyGeometry(fixture.instance, fixture.conditional);
  expect(result.geometries).toHaveLength(4);
  expect([...fixture.conditional]).toEqual(originalConditional);
  expect(result.internals).toHaveLength(3);
  expect(result.internals).toContain(fixture.arrayMaterial);
  expect(result.internals).toContain(fixture.singleton);
  expect(fixture.arrayMaterial.parent).toBe(fixture.front);
  expect(fixture.singleton.parent).toBe(fixture.front);
  expect(fixture.hidden.map(mesh => mesh.parent)).toEqual([fixture.hiddenGroup, fixture.hiddenGroup]);
  const batches = meshesOf(fixture.instance).filter(mesh => result.geometries.includes(mesh.geometry));
  const parts = (mesh: Mesh) => mesh.userData.batchedParts as string[];
  expect(batches.map(parts)).toEqual(expect.arrayContaining([
    ['OutsideA', 'OutsideB'], ['InsideA', 'InsideB'], ['DistinctA', 'DistinctB'], ['RearA', 'RearB'],
  ]));
  expect(batches.find(mesh => parts(mesh).includes('RearA'))!.parent).toBe(fixture.rear);
  expect(batches.find(mesh => parts(mesh).includes('DistinctA'))!.material).toBe(fixture.distinct[0].material);
  expect(batches.find(mesh => parts(mesh).includes('OutsideA'))!.material).toBe(fixture.material);
  const internalBatch = batches.find(mesh => parts(mesh).includes('InsideA'))!;
  expect(result.internals).toContain(internalBatch);
  expect(trianglesOf(fixture.instance, true)).toBe(beforeVisible);
  result.internals.forEach(mesh => { mesh.visible = false; });
  expect(trianglesOf(fixture.instance, true)).toBe(beforeVisible - 8);
  result.internals.forEach(mesh => { mesh.visible = true; });
  expect(trianglesOf(fixture.instance, true)).toBe(beforeVisible);
  result.geometries.forEach(geometry => geometry.dispose());
});

it('bakes nested and reflected transforms, normalizes mixed attributes, and disposes only temporary clones', () => {
  const fixture = syntheticFixture();
  const geometry = fixture.outside[0].geometry.clone();
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('normal', new Int16BufferAttribute(Array.from({ length: count }, () => [0, 0, 32767]).flat(), 3, true));
  geometry.setAttribute('uv', new Uint16BufferAttribute(Array.from({ length: count }, () => [32767, 32767]).flat(), 2, true));
  fixture.outside[0].geometry = geometry;
  const reference = fixture.instance.clone(true);
  const originals = new Set(meshesOf(fixture.instance).map(mesh => mesh.geometry));
  const disposal = vi.spyOn(BufferGeometry.prototype, 'dispose');
  try {
    const result = batchAssemblyGeometry(fixture.instance, fixture.conditional);
    expectBounds(fixture.instance, reference);
    expect(disposal.mock.contexts).toHaveLength(8);
    expect(disposal.mock.contexts.every(disposed => disposed instanceof BufferGeometry && !originals.has(disposed) && !result.geometries.includes(disposed))).toBe(true);
    const outside = meshesOf(fixture.instance).find(mesh => mesh.userData.batchedParts?.includes('OutsideA'))!;
    const position = outside.geometry.getAttribute('position');
    const normal = outside.geometry.getAttribute('normal');
    const uv = outside.geometry.getAttribute('uv');
    expect(Object.keys(outside.geometry.attributes).sort()).toEqual(['normal', 'position', 'uv']);
    expect(position.array).toBeInstanceOf(Float32Array);
    expect(normal.array).toBeInstanceOf(Float32Array);
    expect(uv.getX(0)).toBeCloseTo(32767 / 65535, 6);
    const indices = outside.geometry.index!;
    outside.updateWorldMatrix(true, false);
    const normalMatrix = new Matrix3().getNormalMatrix(outside.matrixWorld);
    for (let index = 0; index < indices.count; index += 3) {
      const ids = [indices.getX(index), indices.getX(index + 1), indices.getX(index + 2)];
      const points = ids.map(id => new Vector3().fromBufferAttribute(position, id).applyMatrix4(outside.matrixWorld));
      const faceNormal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      const vertexNormal = new Vector3().fromBufferAttribute(normal, ids[0]).applyMatrix3(normalMatrix).normalize();
      expect(faceNormal.dot(vertexNormal)).toBeGreaterThan(0.99999);
    }
    result.geometries.forEach(merged => merged.dispose());
    expect(disposal.mock.contexts).toHaveLength(8 + result.geometries.length);
    expect(disposal.mock.contexts.some(disposed => disposed instanceof BufferGeometry && originals.has(disposed))).toBe(false);
  } finally {
    disposal.mockRestore();
  }
});
