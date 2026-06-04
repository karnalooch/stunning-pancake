import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const viteE2e = process.env.VITE_E2E ?? fileEnv.VITE_E2E ?? ''
  const viteApiUrl = process.env.VITE_API_URL ?? fileEnv.VITE_API_URL ?? ''
  return {
  base: '/',
  server: {
    port: 3000,
    strictPort: true,
    proxy: viteE2e === '1'
      ? undefined
      : {
          '/api': {
            target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
            changeOrigin: true,
          },
        },
  },
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
  },
  define: {
    'import.meta.env.VITE_E2E': JSON.stringify(viteE2e),
    'import.meta.env.VITE_API_URL': JSON.stringify(viteApiUrl),
  },
  };
});
