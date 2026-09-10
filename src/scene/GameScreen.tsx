import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Object3D } from 'three';
import { drawGame } from '../game/draw';
import type { GameSession } from '../game/session';
import { useReducedMotion } from '../hooks/useReducedMotion';

export function GameScreen({ object, session, playing }: { object: Object3D; session: GameSession; playing: boolean }) {
  const { invalidate } = useThree();
  const reduced = useReducedMotion();
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 640;
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.flipY = false; map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => {
    if (!playing) return;
    const bindings: { material: MeshStandardMaterial; map: MeshStandardMaterial['map']; emissiveMap: MeshStandardMaterial['emissiveMap'] }[] = [];
    const seen = new Set<MeshStandardMaterial>();
    object.traverse(child => {
      if (!(child instanceof Mesh)) return;
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        if (!(material instanceof MeshStandardMaterial) || material.name !== 'Screen' || seen.has(material)) continue;
        seen.add(material); bindings.push({ material, map: material.map, emissiveMap: material.emissiveMap });
        material.map = material.emissiveMap = texture; material.needsUpdate = true;
      }
    });
    const context = texture.image.getContext('2d')!;
    const paint = () => {
      drawGame(context, session.getState(), reduced); texture.needsUpdate = true;
      object.userData.game = { ...session.getSnapshot(), elapsed: session.getState().elapsed, textureVersion: texture.version };
      invalidate();
    };
    paint(); const unsubscribe = session.subscribeFrame(paint);
    return () => {
      unsubscribe();
      bindings.forEach(({material,map,emissiveMap}) => { material.map = map; material.emissiveMap = emissiveMap; material.needsUpdate = true; });
      delete object.userData.game; invalidate();
    };
  }, [object, session, texture, playing, reduced, invalidate]);
  useEffect(() => () => texture.dispose(), [texture]);
  return null;
}
