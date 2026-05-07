import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts', 'd3-array', 'd3-color', 'd3-format', 'd3-interpolate', 'd3-scale', 'd3-shape', 'd3-time', 'd3-time-format'],
          motion: ['framer-motion'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
