import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/three/')) return 'three';
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
