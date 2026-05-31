import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@tokens': path.resolve(__dirname, '../shared/tokens'),
    },
  },
  optimizeDeps: {
    include: ['maplibre-gl'],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    commonjsOptions: {
      include: [/maplibre-gl/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  }
})
