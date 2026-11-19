import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages project sites are served from /<repo>/, so the base path is
  // driven by an env var. Vercel (requirements.jedlik.in) serves from root.
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Dev convenience: forward /api to the local function runner
      // (node server/standalone.mjs) so local testing hits the same path.
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
