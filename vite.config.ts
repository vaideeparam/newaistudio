import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = process.env.PORT ?? '8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The API server holds Gateway tokens; the browser only talks to /api.
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false },
    },
  },
});
