import path from 'node:path'
import {fileURLToPath, URL} from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import type {Plugin} from 'vite'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const playgroundRoot = fileURLToPath(new URL('.', import.meta.url))
const coreSrc = path.resolve(repoRoot, 'packages/chart-studio/src')
const uiSrc = path.resolve(repoRoot, 'packages/chart-studio-ui/src')
const devtoolsSrc = path.resolve(repoRoot, 'packages/chart-studio-devtools/src')

/** Explicitly watch the library source directories so HMR works for files outside the Vite root. */
function watchLibrarySource(): Plugin {
  return {
    name: 'watch-library-source',
    configureServer(server) {
      server.watcher.add([coreSrc, uiSrc, devtoolsSrc])
    },
  }
}

/**
 * Vite configuration for the local playground.
 * Aliases the published package name back to the local source so UI edits
 * show up immediately without rebuilding the library first.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), watchLibrarySource()],
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
        find: /^@matthieumordrel\/chart-studio\/_internal$/,
        replacement: fileURLToPath(new URL('../../packages/chart-studio/src/_internal.ts', import.meta.url)),
      },
      {
        find: /^@matthieumordrel\/chart-studio-ui$/,
        replacement: fileURLToPath(new URL('../../packages/chart-studio-ui/src/index.ts', import.meta.url)),
      },
      {
        find: /^@matthieumordrel\/chart-studio-devtools\/react$/,
        replacement: fileURLToPath(
          new URL('../../packages/chart-studio-devtools/src/react/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@matthieumordrel\/chart-studio-devtools$/,
        replacement: fileURLToPath(new URL('../../packages/chart-studio-devtools/src/index.ts', import.meta.url)),
      },
      {
        find: /^@matthieumordrel\/chart-studio$/,
        replacement: fileURLToPath(new URL('../../packages/chart-studio/src/index.ts', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    // Exclude the library source from pre-bundling so Vite always serves
    // the latest files and HMR propagates correctly.
    exclude: [
      '@matthieumordrel/chart-studio',
      '@matthieumordrel/chart-studio/_internal',
      '@matthieumordrel/chart-studio-ui',
      '@matthieumordrel/chart-studio-devtools',
      '@matthieumordrel/chart-studio-devtools/react',
    ],
  },
  server: {
    fs: {
      allow: [repoRoot, playgroundRoot],
    },
    watch: {},
  },
})
