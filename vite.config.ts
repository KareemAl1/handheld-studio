import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'handheld-local-preview-health',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__handheld_studio_health', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({
          app: 'handheld-studio',
          pid: process.pid,
          instance: process.env.HANDHELD_PREVIEW_INSTANCE ?? 'foreground',
        }));
      });
    },
  }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
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
