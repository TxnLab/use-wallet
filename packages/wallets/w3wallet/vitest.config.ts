import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'w3wallet',
    dir: './src',
    watch: false,
    globals: true
  }
})
