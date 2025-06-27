import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [sveltekit(), nodePolyfills()],
  ssr: {
    noExternal: ['@algorandfoundation/liquid-auth-use-wallet-client'],
    external: ['cbor-x']
  }
})
