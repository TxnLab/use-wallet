import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'passkey',
    dir: './src',
    watch: false,
    globals: true
  }
})
