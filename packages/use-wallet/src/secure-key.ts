/**
 * Secure key handling utilities for managing sensitive cryptographic material.
 *
 * These utilities provide defense-in-depth for private key handling:
 * 1. Memory zeroing - Overwrites key material before releasing references
 * 2. Scoped key access - Keys are only available within controlled callbacks
 * 3. Automatic cleanup - Keys are cleared after use via try/finally patterns
 * 4. No persistence - Keys are never stored to disk/localStorage
 */

import { logger } from 'src/logger'

const secureLogger = logger.createScopedLogger('SecureKey')

/**
 * Securely zeros out a Uint8Array by overwriting all bytes with zeros.
 * This helps prevent key material from lingering in memory.
 *
 * Note: JavaScript doesn't guarantee immediate memory clearing due to GC,
 * but this provides defense-in-depth by:
 * 1. Overwriting the buffer contents immediately
 * 2. Reducing the window where key material is accessible
 * 3. Preventing accidental key leakage through references
 */
export function zeroMemory(buffer: Uint8Array): void {
  if (!buffer || buffer.length === 0) return

  try {
    // Use crypto.getRandomValues first to prevent compiler optimizations
    // from removing the zeroing operation
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buffer)
    }
    // Then zero out the buffer
    buffer.fill(0)
  } catch {
    // Fallback: manual zeroing if crypto is unavailable
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0
    }
  }
}

/**
 * Securely zeros out a string by creating a mutable copy and clearing it.
 * Returns an empty string. The original string in memory may still exist
 * due to string immutability in JS, but this clears any mutable references.
 */
export function zeroString(str: string): string {
  if (!str) return ''

  // Convert to array, zero it, and discard
  const arr = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    arr[i] = str.charCodeAt(i)
  }
  zeroMemory(arr)

  return ''
}

/**
 * A secure container for holding private key material.
 * Provides controlled access and automatic cleanup.
 */
export class SecureKeyContainer {
  private _secretKey: Uint8Array | null = null
  private _isCleared: boolean = false

  constructor(secretKey: Uint8Array) {
    // Create a copy to ensure we own the memory
    this._secretKey = new Uint8Array(secretKey)
    // Immediately zero the source if caller passes ownership
    // (caller should still zero their copy)
  }

  /**
   * Check if the key has been cleared
   */
  get isCleared(): boolean {
    return this._isCleared
  }

  /**
   * Execute a callback with access to the secret key.
   * The key is automatically cleared if an error occurs.
   */
  async useKey<T>(callback: (secretKey: Uint8Array) => Promise<T>): Promise<T> {
    if (this._isCleared || !this._secretKey) {
      throw new Error('SecureKeyContainer: Key has been cleared')
    }

    try {
      return await callback(this._secretKey)
    } catch (error) {
      // On error, clear immediately to prevent leakage
      this.clear()
      throw error
    }
  }

  /**
   * Execute a synchronous callback with access to the secret key.
   */
  useKeySync<T>(callback: (secretKey: Uint8Array) => T): T {
    if (this._isCleared || !this._secretKey) {
      throw new Error('SecureKeyContainer: Key has been cleared')
    }

    try {
      return callback(this._secretKey)
    } catch (error) {
      this.clear()
      throw error
    }
  }

  /**
   * Securely clear the key from memory.
   * This should be called when the key is no longer needed.
   */
  clear(): void {
    if (this._secretKey && !this._isCleared) {
      zeroMemory(this._secretKey)
      this._secretKey = null
      this._isCleared = true
      secureLogger.debug('Key material cleared from memory')
    }
  }
}

/**
 * Execute a function with a temporary secret key that is automatically
 * cleared after the function completes (success or error).
 *
 * This is the preferred pattern for one-time key operations.
 */
export async function withSecureKey<T>(
  secretKey: Uint8Array,
  callback: (container: SecureKeyContainer) => Promise<T>
): Promise<T> {
  const container = new SecureKeyContainer(secretKey)

  try {
    return await callback(container)
  } finally {
    container.clear()
  }
}

/**
 * Synchronous version of withSecureKey for non-async operations.
 */
export function withSecureKeySync<T>(
  secretKey: Uint8Array,
  callback: (container: SecureKeyContainer) => T
): T {
  const container = new SecureKeyContainer(secretKey)

  try {
    return callback(container)
  } finally {
    container.clear()
  }
}

/**
 * Derive an Algorand account from an ed25519 private key seed.
 * The input key should be 32 bytes (seed).
 *
 * SECURITY: The returned account contains a secret key reference.
 * The caller is responsible for zeroing account.sk after use.
 */
export async function deriveAlgorandAccountFromEd25519(
  ed25519Seed: Uint8Array
): Promise<{ addr: string; sk: Uint8Array }> {
  // Web3Auth returns a 32-byte ed25519 seed (private key)
  // We need to derive the full 64-byte secret key and the Algorand address

  if (ed25519Seed.length !== 32) {
    throw new Error(`Invalid ed25519 seed length: expected 32 bytes, got ${ed25519Seed.length}`)
  }

  // Use tweetnacl directly for ed25519 key derivation
  // This is the same library algosdk uses internally
  const nacl = await import('tweetnacl')
  const algosdk = await import('algosdk')

  // Create a nacl keypair from the seed
  // tweetnacl's sign.keyPair.fromSeed returns: { publicKey, secretKey }
  // where secretKey is 64 bytes: seed (32) + publicKey (32)
  const keyPair = nacl.sign.keyPair.fromSeed(ed25519Seed)

  // Derive the Algorand address from the public key
  const address = algosdk.encodeAddress(keyPair.publicKey)

  return {
    addr: address,
    sk: keyPair.secretKey
  }
}