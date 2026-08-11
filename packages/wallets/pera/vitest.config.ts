import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'pera',
    dir: './src',
    watch: false,
    globals: true
  }
})
