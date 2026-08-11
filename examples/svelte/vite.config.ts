import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss(),
    nodePolyfills({ include: ['buffer', 'process', 'util', 'stream', 'events', 'crypto'] })
  ],
  ssr: {
    noExternal: [],
    external: ['net']
  }
})
