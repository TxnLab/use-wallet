// Client-side polyfills for Web3Auth and other blockchain libraries
// This must run before any Web3Auth code loads

import { Buffer } from 'buffer'
import process from 'process'

// Set up global polyfills
globalThis.Buffer = Buffer
globalThis.process = process

// Ensure global is defined (some libraries expect it)
if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis
}

export default defineNuxtPlugin({})
