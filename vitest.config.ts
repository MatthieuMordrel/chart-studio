import {defineConfig} from 'vitest/config'

/**
 * Vitest configuration for the chart-studio workspace.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    setupFiles: ['./test-support/setup-tests.ts'],
  },
})
