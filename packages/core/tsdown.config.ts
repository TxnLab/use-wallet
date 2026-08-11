import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/adapter.ts', 'src/testing.ts'],
  dts: true,
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  format: ['esm']
})
