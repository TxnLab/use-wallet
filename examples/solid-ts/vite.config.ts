import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'

export default defineConfig({
  plugins: [
    devtools({
      /* features options - all disabled by default */
      autoname: true // e.g. enable autoname
    }),
    solid()
  ],
  build: {
    chunkSizeWarningLimit: 600
  }
})
