import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.PORT ?? '8787';

const staticDemo = process.env.VITE_STATIC_MOCK === '1';

export default defineConfig({
  plugins: [react()],
  // Static demo: one JS file and one CSS file so they can be inlined into a single page.
  ...(staticDemo
    ? { base: './', build: { outDir: 'dist-demo', cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } } }
    : {}),
  server: {
    port: 5173,
    proxy: {
      // The API server holds Gateway tokens; the browser only talks to /api.
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false },
    },
  },
});
