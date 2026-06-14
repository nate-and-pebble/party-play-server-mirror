import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// The Node server's port. In dev, Vite proxies the realtime channel to it so
// the client only talks to one origin. In production the server serves the
// built client and there is no proxy.
const SERVER_PORT = process.env.SERVER_PORT || '3001';

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      '@partyplay/shared': resolve(here, '../shared/src/index.ts'),
    },
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
