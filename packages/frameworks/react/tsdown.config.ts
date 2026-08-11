import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.tsx'],
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  format: ['esm']
})
