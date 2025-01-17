import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'use-wallet',
    dir: './src',
    watch: false,
    globals: true,
    setupFiles: './setupTests.ts'
  }
})
