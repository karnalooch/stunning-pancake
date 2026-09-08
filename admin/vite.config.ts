import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const repoReact = path.resolve(__dirname, '../node_modules/react')
const repoReactDom = path.resolve(__dirname, '../node_modules/react-dom')

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
    react({
      exclude: /node_modules/,
    }),
  ],
  resolve: {
    alias: {
      '@tokens': path.resolve(__dirname, '../packages/tokens'),
      react: repoReact,
      'react-dom': repoReactDom,
      'react-dom/client': path.resolve(repoReactDom, 'client'),
      'react/jsx-runtime': path.resolve(repoReact, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(repoReact, 'jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'react', 'react-dom', 'react/jsx-dev-runtime', 'react/jsx-runtime'],
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
    // Pure *.test.ts — node (szybkie, bez wiszącego jsdom). DOM tylko dla *.test.tsx.
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
    ],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    pool: 'forks',
    isolate: true,
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    server: {
      deps: {
        inline: [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          '@mantine/core',
          '@mantine/hooks',
          'lucide-react',
        ],
        optimizer: {
          client: {
            enabled: false,
          },
        },
      },
    },
  },
  define: {
    'import.meta.env.VITE_E2E': JSON.stringify(viteE2e),
    'import.meta.env.VITE_API_URL': JSON.stringify(viteApiUrl),
  },
  };
});
