/// <reference lib="webworker" />
/**
 * Key worker: holds a Falcon-1024 private key so it never lives on the page's
 * main thread. Only public keys and signatures cross the port.
 *
 * falcon-1024 instantiates its WASM with a top-level await, so this must run
 * as a module worker. falcon-1024 frees its WASM buffers without wiping them,
 * so the page terminates the worker to drop the key, rather than relying on
 * `lock` alone.
 */
import { generateKey, signCompressed } from 'falcon-1024'
import { keygenSeedFromEntropy } from '../derivation'
import type { WorkerRequest, WorkerResponse } from './protocol'

declare const self: DedicatedWorkerGlobalScope

let privateKey: Uint8Array | null = null
let idleTimeoutMs = 0
let idleTimer: ReturnType<typeof setTimeout> | undefined

function post(message: WorkerResponse): void {
  self.postMessage(message)
}

function wipe(): void {
  privateKey?.fill(0)
  privateKey = null
  clearTimeout(idleTimer)
}

function touch(): void {
  if (!idleTimeoutMs) return
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    wipe()
    post({ type: 'locked', reason: 'idle' })
  }, idleTimeoutMs)
}

function unlock(entropyBuffer: ArrayBuffer, timeoutMs = 0): Uint8Array {
  const entropy = new Uint8Array(entropyBuffer)
  const keygenSeed = keygenSeedFromEntropy(entropy)
  entropy.fill(0)

  wipe()
  try {
    const keys = generateKey(keygenSeed)
    privateKey = keys.privateKey
    idleTimeoutMs = timeoutMs
    touch()
    return keys.publicKey
  } finally {
    keygenSeed.fill(0)
  }
}

function sign(bytes: Uint8Array): Uint8Array {
  if (!privateKey) throw new Error('locked')
  touch()
  return signCompressed(privateKey, bytes)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    let value: unknown
    switch (request.op) {
      case 'unlock':
        value = unlock(request.entropy, request.idleTimeoutMs)
        break
      case 'sign':
        value = sign(request.bytes)
        break
      case 'lock':
        wipe()
        value = true
        break
    }
    post({ type: 'result', id: request.id, ok: true, value })
  } catch (error) {
    post({
      type: 'result',
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

post({ type: 'ready' })
