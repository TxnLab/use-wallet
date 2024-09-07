import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'avm-wallet',
    dir: './src',
    watch: false,
    globals: true
  }
})
