import {fileURLToPath, URL} from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const playgroundRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * Vite configuration for the local playground.
 * Aliases the published package name back to the local source so UI edits
 * show up immediately without rebuilding the library first.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^react$/,
        replacement: fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url)),
      },
      {
        find: /^react\/jsx-runtime$/,
        replacement: fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url)),
      },
      {
        find: /^react\/jsx-dev-runtime$/,
        replacement: fileURLToPath(
          new URL('./node_modules/react/jsx-dev-runtime.js', import.meta.url),
        ),
      },
      {
        find: /^react-dom$/,
        replacement: fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url)),
      },
      {
        find: /^react-dom\/client$/,
        replacement: fileURLToPath(new URL('./node_modules/react-dom/client.js', import.meta.url)),
      },
      {
        find: '@matthieumordrel/chart-studio/ui',
        replacement: fileURLToPath(new URL('../../src/ui/index.ts', import.meta.url)),
      },
      {
        find: '@matthieumordrel/chart-studio/core',
        replacement: fileURLToPath(new URL('../../src/core/index.ts', import.meta.url)),
      },
      {
        find: '@matthieumordrel/chart-studio',
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    fs: {
      allow: [repoRoot, playgroundRoot],
    },
  },
})
