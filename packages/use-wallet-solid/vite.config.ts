import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid({ ssr: false })],
  test: {
    name: 'use-wallet-solid',
    dir: './src',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true
  },
  resolve: {
    conditions: ['development', 'browser']
  }
})
