import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

const repoRoot = dirname(fileURLToPath(import.meta.url))

/**
 * Vitest uses Vite for transforms; it does not read `tsconfig` `paths`. Without these
 * aliases, imports like `@matthieumordrel/chart-studio` resolve via `package.json`
 * `exports` to `dist/`, which does not exist yet when `release` runs tests before
 * `build` (and on a fresh CI checkout).
 */
const workspaceAliases = [
  {
    find: '@matthieumordrel/chart-studio/_internal',
    replacement: resolve(repoRoot, 'packages/chart-studio/src/_internal.ts'),
  },
  {
    find: '@matthieumordrel/chart-studio',
    replacement: resolve(repoRoot, 'packages/chart-studio/src/index.ts'),
  },
  {
    find: '@matthieumordrel/chart-studio-ui',
    replacement: resolve(repoRoot, 'packages/chart-studio-ui/src/index.ts'),
  },
] as const

/**
 * Vitest configuration for the chart-studio workspace.
 */
export default defineConfig({
  resolve: {
    alias: [...workspaceAliases],
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    setupFiles: ['./test-support/setup-tests.ts'],
  },
})
