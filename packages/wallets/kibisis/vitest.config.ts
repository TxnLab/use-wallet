import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'kibisis',
    dir: './src',
    watch: false,
    globals: true
  }
})
