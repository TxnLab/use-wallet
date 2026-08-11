import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'kmd',
    dir: './src',
    watch: false,
    globals: true
  }
})
