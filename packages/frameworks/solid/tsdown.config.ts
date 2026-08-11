import { defineConfig } from 'tsdown'

const shared = {
  format: ['esm'] as ['esm'],
  fixedExtension: false,
  sourcemap: true,
  deps: {
    neverBundle: ['solid-js']
  }
}

export default defineConfig([
  {
    // Standard ESM + DTS build
    entry: { index: 'src/index.tsx' },
    ...shared,
    dts: true,
    clean: true
  },
  {
    // Development ESM build (same source, no console stripping)
    entry: { dev: 'src/index.tsx' },
    ...shared
  },
  {
    // Solid JSX build (preserved JSX, .jsx extension) for `solid` condition
    entry: { index: 'src/index.tsx', dev: 'src/index.tsx' },
    ...shared,
    outExtensions: () => ({ js: '.jsx' })
  }
])
