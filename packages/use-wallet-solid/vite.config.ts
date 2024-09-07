import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  test: {
    name: 'avm-wallet-solid',
    dir: './src',
    watch: false,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true
  }
})
