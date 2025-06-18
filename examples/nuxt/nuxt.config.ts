export default defineNuxtConfig({
  devtools: { enabled: true },

  typescript: {
    strict: true
  },

  vite: {
    define: {
      global: 'globalThis'
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700
    }
  },

  compatibilityDate: '2025-05-02'
})
