import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Float32BufferAttribute, Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { BufferGeometry, Material } from 'three';
import { BUTTONS, SHELLS } from '../config/config';
import type { Configuration } from '../config/config';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { makeGrainTexture, makeScreenTexture } from './textures';
import { ASSEMBLY_PARTS, assemblyOffset, clampAssembly } from './assembly';
import { batchAssemblyGeometry } from './optimizeGeometry';
import type { MutableRefObject } from 'react';

const colorDifference = (a: Color, b: Color) => (a.r-b.r)**2 + (a.g-b.g)**2 + (a.b-b.b)**2;

export function ConsoleModel({ config, assembly, progress, onReady, onAssemblyRest }: { config: Configuration; assembly: number; progress: MutableRefObject<number>; onReady: () => void; onAssemblyRest: () => void }) {
  const { scene } = useGLTF('/models/hs-01.glb');
  const { invalidate } = useThree();
  const reduced = useReducedMotion();
  const transition = useRef({ time: 0, active: false });
  const shadowAssembly = useRef(-1);
  const owned = useMemo(() => {
    const instance = scene.clone(true);
    const copies = new Map<Material, MeshStandardMaterial>();
    const geometries: BufferGeometry[] = [];
    const shellMaterials: MeshPhysicalMaterial[] = [];
    const buttonMaterials: MeshStandardMaterial[] = [];
    const legendMaterials: MeshStandardMaterial[] = [];
    const internals: Mesh[] = [];
    const screenTexture = makeScreenTexture();
    const grain = makeGrainTexture();
    instance.name = 'Handheld';
    instance.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if ((object.userData.assembly === 'board' && !/^(USB|Speaker)/.test(object.name)) || /^(CircuitBoard|InternalFrame|Battery|Chip|Contact|Mount)/.test(object.name)) internals.push(object);
      const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const instanceMaterials = originalMaterials.map((original) => {
        let material = copies.get(original);
        if (!material) {
          material = original.clone() as MeshStandardMaterial;
          if (material.name === 'ShellFront' || material.name === 'ShellBack') {
            const physical = new MeshPhysicalMaterial({
              name: material.name, color: material.color, roughness: 0.43, metalness: 0,
              clearcoat: 0.22, clearcoatRoughness: 0.28, ior: 1.46,
              thickness: 0.081, attenuationDistance: 0.9, envMapIntensity: 0.85,
              bumpMap: grain, bumpScale: 0.004,
            });
            material.dispose(); material = physical;
            shellMaterials.push(physical);
          }
          if (material.name === 'Controls') { material.roughness = 0.59; buttonMaterials.push(material); }
          if (material.name === 'KeyInk') legendMaterials.push(material);
          if (material.name === 'Accent') { material.color.set('#c95330'); material.roughness = 0.35; }
          if (material.name === 'Screen') {
            material.map = screenTexture; material.emissiveMap = screenTexture;
            material.emissive.set('#ffffff'); material.emissiveIntensity = 0.3;
            material.color.set('#ffffff'); material.roughness = 0.5; material.metalness = 0;
            material.toneMapped = false;
          }
          if (material.name === 'Glass') {
            material.dispose();
            material = new MeshPhysicalMaterial({ name: 'Glass', color: '#dbe6de',
              transparent: true, opacity: 0.1, roughness: 0.09, metalness: 0.08,
              clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, depthWrite: false });
          }
          copies.set(original, material);
        }
        return material;
      });
      object.material = Array.isArray(object.material) ? instanceMaterials : instanceMaterials[0];
      if (instanceMaterials.some((material) => material.name === 'ShellFront' || material.name === 'ShellBack')) {
        const geometry = object.geometry.clone();
        const positions = geometry.getAttribute('position');
        geometry.computeBoundingBox();
        const dimensions = geometry.boundingBox!.max.clone().sub(geometry.boundingBox!.min);
        const axes = [0,1,2].sort((a,b) => dimensions.getComponent(b) - dimensions.getComponent(a));
        const uv: number[] = [];
        for (let i=0;i<positions.count;i++) {
          const xyz = [positions.getX(i), positions.getY(i), positions.getZ(i)];
          uv.push(xyz[axes[0]] / 6.4 + 0.5, xyz[axes[1]] / 3.44 + 0.5);
        }
        geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        object.geometry = geometry; geometries.push(geometry);
      }
    });
    const batched = batchAssemblyGeometry(instance, new Set(internals));
    geometries.push(...batched.geometries);
    const groups = ASSEMBLY_PARTS.map(part => ({ part, object: instance.getObjectByName(part.node)!, base: instance.getObjectByName(part.node)!.position.clone() }));
    return { instance, groups, shellMaterials, buttonMaterials, legendMaterials, internals: batched.internals, geometries, materials: [...copies.values()], screenTexture, grain };
  }, [scene]);
  const targets = useMemo(() => ({
    shell: new Color(SHELLS.find((shell) => shell.id === config.shell)!.hex).lerp(new Color('#ffffff'), config.finish === 'translucent' ? 0.28 : 0),
    attenuation: new Color(SHELLS.find((shell) => shell.id === config.shell)!.hex),
    buttons: new Color(BUTTONS.find((button) => button.id === config.buttons)!.hex),
    legend: new Color(config.buttons === 'ivory' ? '#333b37' : '#e5e0d2'),
    transmission: config.finish === 'translucent' ? 0.76 : 0,
    roughness: config.finish === 'translucent' ? 0.18 : 0.43,
  }), [config]);

  useEffect(() => {
    transition.current = { time: performance.now(), active: true };
    invalidate();
  }, [targets, assembly, reduced, invalidate]);

  useFrame(() => {
    if (!transition.current.active) return;
    const now = performance.now();
    const blend = reduced ? 1 : 1 - Math.exp(-12 * Math.min((now - transition.current.time) / 1000, 0.05));
    transition.current.time = now;
    let remaining = 0;
    const goal = clampAssembly(assembly);
    progress.current += (goal - progress.current) * blend;
    if (Math.abs(progress.current - goal) < 0.0001) progress.current = goal;
    if (progress.current === goal && shadowAssembly.current !== goal) {
      shadowAssembly.current = goal;
      onAssemblyRest();
    }
    remaining += Math.abs(progress.current - goal);
    owned.groups.forEach(({ part, object, base }) => {
      object.position.copy(base); object.position.z += assemblyOffset(part.id, progress.current);
    });
    owned.instance.userData.assembly = { progress: progress.current, layers: owned.groups.map(({part,object}) => ({id:part.id, position:object.position.toArray()})) };
    for (const material of owned.shellMaterials) {
      material.color.lerp(targets.shell, blend);
      material.attenuationColor.lerp(targets.attenuation, blend);
      const previous = material.transmission;
      material.transmission += (targets.transmission - material.transmission) * blend;
      material.roughness += (targets.roughness - material.roughness) * blend;
      if (Math.abs(material.transmission - targets.transmission) < 0.0001) material.transmission = targets.transmission;
      if ((previous === 0) !== (material.transmission === 0)) material.needsUpdate = true;
      remaining += Math.abs(material.transmission - targets.transmission) + colorDifference(material.color, targets.shell) + colorDifference(material.attenuationColor, targets.attenuation);
    }
    for (const [materials, color] of [[owned.buttonMaterials, targets.buttons], [owned.legendMaterials, targets.legend]] as const) {
      for (const material of materials) { material.color.lerp(color, blend); remaining += colorDifference(material.color, color); }
    }
    owned.internals.forEach((mesh) => { mesh.visible = progress.current > 0.001 || targets.transmission > 0 || owned.shellMaterials.some((material) => material.transmission > 0.001); });
    owned.instance.userData.materials = { shell: owned.shellMaterials[0]?.color.getHexString(), buttons: owned.buttonMaterials[0]?.color.getHexString(), transmission: owned.shellMaterials[0]?.transmission };
    if (remaining < 0.0000001) {
      owned.shellMaterials.forEach((material) => { material.color.copy(targets.shell); material.roughness = targets.roughness; });
      owned.buttonMaterials.forEach((material) => material.color.copy(targets.buttons));
      owned.legendMaterials.forEach((material) => material.color.copy(targets.legend));
      transition.current.active = false;
    } else invalidate();
  });

  useEffect(() => { onReady(); }, [onReady]);
  useEffect(() => () => {
    owned.materials.forEach((material) => material.dispose());
    owned.geometries.forEach((geometry) => geometry.dispose());
    owned.screenTexture.dispose(); owned.grain.dispose();
  }, [owned]);
  return <primitive object={owned.instance} dispose={null} />;
}
