import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'use-wallet-js',
    dir: './src',
    watch: false,
    globals: true
  }
})
