import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Material } from 'three';
import { SHELLS } from '../config/config';
import type { Configuration } from '../config/config';

// An original boot display, kept as a replaceable material for the later tiny game.
function makeScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b2827'; ctx.fillRect(0, 0, 1024, 640);
  ctx.strokeStyle = '#34433d'; ctx.lineWidth = 1;
  for (let x = 32; x < 1024; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
  for (let y = 32; y < 640; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
  ctx.fillStyle = '#acb99c'; ctx.font = '20px monospace'; ctx.fillText('HANDHELD SYSTEMS', 54, 58);
  ctx.textAlign = 'right'; ctx.fillText('01', 968, 58);
  ctx.strokeStyle = '#acb99c'; ctx.strokeRect(915, 92, 48, 19); ctx.fillRect(965, 97, 4, 9);
  ctx.fillRect(920, 97, 32, 9);
  ctx.textAlign = 'center'; ctx.fillStyle = '#d6dfba'; ctx.font = 'bold 118px Arial'; ctx.fillText('hello,', 512, 312);
  ctx.fillStyle = '#e5834b'; ctx.fillText('player.', 512, 429);
  ctx.fillStyle = '#aebc9b'; ctx.font = '20px monospace'; ctx.fillText('A SMALL WORLD OF POSSIBILITY', 512, 535);
  ctx.textAlign = 'left'; ctx.fillStyle = '#4c5d4c'; ctx.fillRect(54, 585, 916, 1);
  ctx.fillStyle = '#8e9e86'; ctx.font = '15px monospace'; ctx.fillText('HS–01 / STUDIO EDITION', 54, 613);
  ctx.textAlign = 'right'; ctx.fillText('READY WHEN YOU ARE', 969, 613);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}

export function ConsoleModel({ config, onReady }: { config: Configuration; onReady: () => void }) {
  const { scene } = useGLTF('/models/hs-01.glb');
  const { invalidate } = useThree();
  const owned = useMemo(() => {
    const instance = scene.clone(true);
    const copies = new Map<Material, Material>();
    const shellMaterials: MeshStandardMaterial[] = [];
    const screenTexture = makeScreenTexture();
    instance.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Hidden internals retain their nodes and origins for the later clear-shell mode.
      if (/^(CircuitBoard|InternalFrame|Battery|Chip|Contact|Mount)/.test(object.name)) object.visible = false;
      const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const instanceMaterials = originalMaterials.map((original) => {
        let material = copies.get(original) as MeshStandardMaterial | undefined;
        if (!material) {
          material = original.clone() as MeshStandardMaterial;
          copies.set(original, material);
          if (material.name === 'ShellFront' || material.name === 'ShellBack') {
            material.roughness = 0.43;
            material.metalness = 0;
            shellMaterials.push(material);
          }
          if (material.name === 'Controls') { material.color.set('#333b37'); material.roughness = 0.63; }
          if (material.name === 'Accent') { material.color.set('#c95330'); material.roughness = 0.4; }
          if (material.name === 'Screen') {
            material.map = screenTexture;
            material.emissiveMap = screenTexture;
            material.emissive.set('#ffffff');
            material.emissiveIntensity = 0.3;
            material.color.set('#ffffff');
            material.roughness = 0.5;
            material.metalness = 0;
            material.toneMapped = false;
          }
          if (material.name === 'Glass') { material.opacity = 0.055; material.roughness = 0.17; material.depthWrite = false; }
        }
        return material;
      });
      object.material = Array.isArray(object.material) ? instanceMaterials : instanceMaterials[0];
    });
    return { instance, shellMaterials, materials: [...copies.values()], screenTexture };
  }, [scene]);

  useEffect(() => {
    const color = SHELLS.find((shell) => shell.id === config.shell)!.hex;
    owned.shellMaterials.forEach((material) => material.color.set(color));
    invalidate();
  }, [config.shell, owned, invalidate]);

  useEffect(() => { onReady(); }, [onReady]);
  useEffect(() => () => {
    owned.materials.forEach((material) => material.dispose());
    owned.screenTexture.dispose();
  }, [owned]);

  return <primitive object={owned.instance} dispose={null} />;
}
