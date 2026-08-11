import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: './src',
    watch: false,
    globals: true
  }
})
