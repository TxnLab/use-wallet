import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  test: {
    name: 'use-wallet-solid',
    dir: './src',
    watch: false,
    environment: 'jsdom',
    globals: true
  }
})
