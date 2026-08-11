import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'lute',
    dir: './src',
    watch: false,
    globals: true
  }
})
