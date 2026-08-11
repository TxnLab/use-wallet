import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'walletconnect',
    dir: './src',
    watch: false,
    globals: true
  }
})
