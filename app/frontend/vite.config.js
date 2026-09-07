import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The backend is reverse-proxied under /api in production (see deploy/nginx).
// In development, requests to /api are proxied straight to the local API server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
