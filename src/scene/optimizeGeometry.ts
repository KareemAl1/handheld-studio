import { Float32BufferAttribute, Matrix4, Mesh } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSEMBLY_PARTS } from './assembly';

type Batch = { meshes: Mesh[]; conditional: boolean };

function canBatch(mesh: Mesh): boolean {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  if (Array.isArray(mesh.material) || mesh.material.vertexColors || !position || position.itemSize !== 3) return false;
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (normal && (normal.itemSize !== 3 || normal.count !== position.count)) return false;
  if (uv && (uv.itemSize !== 2 || uv.count !== position.count)) return false;
  if (mesh.children.length || 'isSkinnedMesh' in mesh || 'isInstancedMesh' in mesh) return false;
  if (mesh.matrixWorld.determinant() === 0) return false;
  if (Object.values(geometry.morphAttributes).some(attributes => attributes && attributes.length > 0)) return false;
  // A partial draw range must not become a complete mesh during the merge.
  const count = geometry.index?.count ?? position.count;
  return geometry.drawRange.start === 0 && geometry.drawRange.count >= count && count % 3 === 0;
}

function prepareGeometry(mesh: Mesh, relative: Matrix4): BufferGeometry {
  const geometry = mesh.geometry.clone();
  try {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const positions = new Float32Array(position.count * 3);
    const normals = normal ? new Float32Array(position.count * 3) : undefined;
    const uvs = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index++) {
      positions[index * 3] = position.getX(index);
      positions[index * 3 + 1] = position.getY(index);
      positions[index * 3 + 2] = position.getZ(index);
      if (normal && normals) {
        normals[index * 3] = normal.getX(index);
        normals[index * 3 + 1] = normal.getY(index);
        normals[index * 3 + 2] = normal.getZ(index);
      }
      if (uv) {
        uvs[index * 2] = uv.getX(index);
        uvs[index * 2 + 1] = uv.getY(index);
      }
    }
    // glTF can mix interleaved, normalized and plain attributes. Every merge
    // input uses the same float attributes without changing a cached buffer.
    for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    const indices = geometry.index
      ? Array.from({ length: geometry.index.count }, (_, index) => geometry.index!.getX(index))
      : Array.from({ length: position.count }, (_, index) => index);
    geometry.setIndex(indices);
    if (normals) geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    else geometry.computeVertexNormals();
    geometry.clearGroups();
    geometry.applyMatrix4(relative);
    // Baking a reflected transform removes Three's per-object winding flip.
    if (relative.determinant() < 0) {
      const index = geometry.index!;
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        const second = index.getX(triangle + 1);
        index.setX(triangle + 1, index.getX(triangle + 2));
        index.setX(triangle + 2, second);
      }
    }
    return geometry;
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}

/** Batch static parts while retaining independently movable assembly roots.
 * The caller owns the returned geometries; source buffers and materials remain
 * untouched. Use the returned internals instead of the original conditional set.
 */
export function batchAssemblyGeometry(instance: Object3D, conditional: Set<Mesh>): { geometries: BufferGeometry[]; internals: Mesh[] } {
  const geometries: BufferGeometry[] = [];
  const internals = new Set(conditional);
  const roots = ASSEMBLY_PARTS.flatMap(part => {
    const root = instance.getObjectByName(part.node);
    return root ? [root] : [];
  });
  const rootSet = new Set(roots);
  instance.updateWorldMatrix(true, true);

  for (const root of roots) {
    // A singular group transform cannot be inverted safely.
    if (root.matrixWorld.determinant() === 0) continue;
    const inverse = root.matrixWorld.clone().invert();
    const materials = new Map<Material, Map<string, Batch>>();
    const collect = (object: Object3D) => {
      if (object !== root && rootSet.has(object)) return;
      if (object instanceof Mesh && object !== root && canBatch(object)) {
        const material = object.material as Material;
        const isConditional = conditional.has(object);
        const signature = [isConditional, object.visible, object.castShadow, object.receiveShadow,
          object.renderOrder, object.layers.mask, object.frustumCulled].join(':');
        let variants = materials.get(material);
        if (!variants) { variants = new Map(); materials.set(material, variants); }
        let batch = variants.get(signature);
        if (!batch) { batch = { meshes: [], conditional: isConditional }; variants.set(signature, batch); }
        batch.meshes.push(object);
      }
      // Keep descendants of hidden intermediate groups in their hierarchy.
      if (object === root || object.visible) object.children.forEach(collect);
    };
    collect(root);

    for (const [material, variants] of materials) {
      for (const batch of variants.values()) {
        if (batch.meshes.length < 2) continue;
        const temporary: BufferGeometry[] = [];
        let merged: BufferGeometry | null = null;
        try {
          for (const mesh of batch.meshes) {
            const relative = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
            temporary.push(prepareGeometry(mesh, relative));
          }
          merged = mergeGeometries(temporary, false);
        } catch {
          // Unsupported input keeps its original meshes and ownership intact.
          continue;
        } finally {
          temporary.forEach(geometry => geometry.dispose());
        }
        if (!merged) continue;
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const first = batch.meshes[0];
        const replacement = new Mesh(merged, material);
        replacement.name = `${root.name}_${material.name || 'Material'}_${batch.conditional ? 'Internal' : 'Visible'}Batch`;
        replacement.visible = first.visible;
        replacement.castShadow = first.castShadow;
        replacement.receiveShadow = first.receiveShadow;
        replacement.renderOrder = first.renderOrder;
        replacement.layers.mask = first.layers.mask;
        replacement.frustumCulled = first.frustumCulled;
        replacement.userData = { assembly: root.userData.assembly, batchedParts: batch.meshes.map(mesh => mesh.name) };
        root.add(replacement);
        for (const mesh of batch.meshes) { mesh.removeFromParent(); internals.delete(mesh); }
        if (batch.conditional) internals.add(replacement);
        geometries.push(merged);
      }
    }
  }
  return { geometries, internals: [...internals] };
}
