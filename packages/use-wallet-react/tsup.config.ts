import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  format: ['esm', 'cjs']
})
