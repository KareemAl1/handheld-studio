import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { Configuration } from '../config/config';
import { exportDevicePng } from './exportDevice';

export type ExportImage = (config: Configuration) => Promise<Blob>;

export function ExportBridge({ loaded, onReady }: { loaded: boolean; onReady: (exporter: ExportImage | null) => void }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!loaded) return;
    onReady(config => exportDevicePng(gl, scene, config));
    return () => onReady(null);
  }, [gl, scene, loaded, onReady]);
  return null;
}
