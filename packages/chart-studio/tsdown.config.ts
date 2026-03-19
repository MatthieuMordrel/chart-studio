import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/_internal.ts'],
  format: 'esm',
  unbundle: true,
  dts: true,
  outDir: 'dist',
})
