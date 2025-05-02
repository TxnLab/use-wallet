import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  typescript: {
    strict: true
  },

  vite: {
    define: {
      global: 'globalThis'
    },
    //@ts-expect-error vite
    plugins: [nodePolyfills()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700
    }
  },

  compatibilityDate: '2025-05-02'
})
