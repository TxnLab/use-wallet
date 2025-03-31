import solidPlugin from 'vite-plugin-solid'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      solidPlugin({
        ssr: false
      })
    ],
    test: {
      name: 'use-wallet-solid',
      dir: './src',
      watch: false,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      globals: true
    }
  })
)
