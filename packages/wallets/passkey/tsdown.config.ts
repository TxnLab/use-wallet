import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  format: ['esm']
})
