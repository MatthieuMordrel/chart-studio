import {defineConfig} from 'vitest/config'

/**
 * Vitest configuration for the standalone chart-studio package.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup-tests.ts'],
  },
})
