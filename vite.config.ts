import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'path';

// Vite builds the new Mission Control frontend from web/ into dist/web/.
// The Hono backend at src/dashboard.ts serves dist/web/index.html at the
// `/` route when DASHBOARD_LEGACY is not set to "true". Existing endpoints
// keep their shape; this is purely an additive frontend swap.
export default defineConfig({
  root: 'web',
  plugins: [preact(), tailwind()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // Single-page app: keep entry chunk tight, code-split routes lazily.
        manualChunks: {
          vendor: ['preact', '@preact/signals', 'wouter-preact', 'lucide-preact'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the running Hono dashboard on :3141 in dev so
      // the new frontend can hit real endpoints without CORS gymnastics.
      '/api': 'http://localhost:3141',
      '/ws': { target: 'ws://localhost:3141', ws: true },
      // The text war room is served as a legacy HTML page by the backend
      // at /warroom/text. Anything under /warroom/text/* goes straight
      // through to backend so meetings still open from the v2 launcher.
      '/warroom/text': 'http://localhost:3141',
      '/warroom-music': 'http://localhost:3141',
      '/warroom-client.js': 'http://localhost:3141',
      '/warroom-avatar': 'http://localhost:3141',
      '/warroom-test-audio': 'http://localhost:3141',
      '/warroom-music-upload': 'http://localhost:3141',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'web/src'),
      // Wouter pulls in `react` shims; alias to preact/compat for the few
      // places it asks. preset-vite handles this automatically for most
      // libraries but we keep this explicit for safety.
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
});
