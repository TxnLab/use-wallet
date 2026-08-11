import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-06',
  ssr: false,
  css: ['~/assets/css/main.css'],
  vite: {
    // @ts-expect-error Vite version mismatch between plugins and Nuxt's bundled Vite
    plugins: [tailwindcss(), nodePolyfills()]
  }
})
