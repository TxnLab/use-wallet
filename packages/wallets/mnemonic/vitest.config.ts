import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'mnemonic',
    dir: './src',
    watch: false,
    globals: true
  }
})
