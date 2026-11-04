import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'use-wallet',
    dir: './src',
    watch: false,
    globals: true,
    setupFiles: './setupTests.ts',
    deps: {
      // Import CommonJS packages the way Node and bundlers do, without Vitest's
      // named-export shim, so a dynamic import that only works under Vitest fails here
      interopDefault: false
    }
  }
})
