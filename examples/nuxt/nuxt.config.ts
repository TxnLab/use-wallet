export default defineNuxtConfig({
  devtools: { enabled: true },

  // Disable SSR - wallet connections are client-side only
  ssr: false,

  typescript: {
    strict: true
  },

  vite: {
    define: {
      // Required for some Web3Auth dependencies
      global: 'globalThis'
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 700
    },
    optimizeDeps: {
      include: ['buffer', 'process']
    }
  },

  compatibilityDate: '2025-05-02'
})
