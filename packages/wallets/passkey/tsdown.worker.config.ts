import { defineConfig } from 'tsdown'

// Builds the session worker as one self-contained ES module (falcon-1024's WASM
// is already embedded in its JS). scripts/embed-worker.mjs then inlines the
// output as a string, so consumers start it from a Blob URL and their bundlers
// never see a worker entry to resolve.
export default defineConfig({
  entry: { 'session-worker': 'src/worker/session-worker.ts' },
  outDir: 'dist-worker',
  platform: 'browser',
  format: ['esm'],
  target: 'es2022',
  fixedExtension: false,
  dts: false,
  sourcemap: false,
  clean: true,
  minify: true,
  deps: { alwaysBundle: [/.*/] }
})
