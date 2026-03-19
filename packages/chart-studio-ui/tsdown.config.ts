import {cpSync} from 'node:fs'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  unbundle: true,
  dts: true,
  outDir: 'dist',
  onSuccess: () => {
    cpSync('src/ui/theme.css', 'dist/theme.css')
  },
})
