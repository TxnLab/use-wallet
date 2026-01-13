import { describe, it, expect, vi } from 'vitest'
import algosdk from 'algosdk'
import {
  zeroMemory,
  zeroString,
  SecureKeyContainer,
  withSecureKey,
  withSecureKeySync,
  deriveAlgorandAccountFromEd25519
} from 'src/secure-key'

// Mock logger
vi.mock('src/logger', () => ({
  logger: {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

/**
 * Helper to extract the 32-byte seed from a 64-byte Algorand secret key.
 * Algorand's sk is [seed (32 bytes) | public key (32 bytes)]
 */
function extractSeedFromSecretKey(sk: Uint8Array): Uint8Array {
  return sk.slice(0, 32)
}

/**
 * Simulates how Web3Auth returns private keys for non-EVM chains.
 * Web3Auth returns the raw ed25519 seed as a hex string.
 */
function simulateWeb3AuthPrivateKeyResponse(sk: Uint8Array): string {
  const seed = extractSeedFromSecretKey(sk)
  return Array.from(seed)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Converts a hex string back to Uint8Array (simulating parsing Web3Auth response)
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16)
  }
  return bytes
}

describe('secure-key utilities', () => {
  describe('zeroMemory', () => {
    it('should zero out a Uint8Array', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5])
      zeroMemory(buffer)

      expect(buffer.every((byte) => byte === 0)).toBe(true)
    })

    it('should zero out a real Algorand secret key', () => {
      // Generate a real Algorand account
      const account = algosdk.generateAccount()
      const skCopy = new Uint8Array(account.sk)

      // Verify sk has data
      expect(skCopy.length).toBe(64)
      expect(skCopy.some((byte) => byte !== 0)).toBe(true)

      // Zero it
      zeroMemory(skCopy)

      // Verify it's all zeros
      expect(skCopy.every((byte) => byte === 0)).toBe(true)
    })

    it('should handle empty buffer', () => {
      const buffer = new Uint8Array(0)
      expect(() => zeroMemory(buffer)).not.toThrow()
    })

    it('should handle large buffers', () => {
      const buffer = new Uint8Array(10000)
      buffer.fill(255)
      zeroMemory(buffer)

      expect(buffer.every((byte) => byte === 0)).toBe(true)
    })
  })

  describe('zeroString', () => {
    it('should return empty string', () => {
      const result = zeroString('secret')
      expect(result).toBe('')
    })

    it('should handle empty string', () => {
      const result = zeroString('')
      expect(result).toBe('')
    })
  })

  describe('SecureKeyContainer', () => {
    it('should create a container with a copy of the key', () => {
      const originalKey = new Uint8Array([1, 2, 3, 4, 5])
      const container = new SecureKeyContainer(originalKey)

      expect(container.isCleared).toBe(false)

      // Verify the container has its own copy
      let keyFromContainer: Uint8Array | null = null
      container.useKeySync((key) => {
        keyFromContainer = key
      })

      expect(keyFromContainer).not.toBe(originalKey)
      expect(Array.from(keyFromContainer!)).toEqual([1, 2, 3, 4, 5])

      container.clear()
    })

    it('should safely hold a real Algorand secret key seed', () => {
      // Generate real Algorand account and extract the 32-byte seed
      const account = algosdk.generateAccount()
      const seed = extractSeedFromSecretKey(account.sk)

      const container = new SecureKeyContainer(seed)

      expect(container.isCleared).toBe(false)

      // Verify we can access the seed
      let seedFromContainer: Uint8Array | null = null
      container.useKeySync((key) => {
        seedFromContainer = new Uint8Array(key)
      })

      expect(seedFromContainer!.length).toBe(32)
      expect(Array.from(seedFromContainer!)).toEqual(Array.from(seed))

      container.clear()
      expect(container.isCleared).toBe(true)
    })

    it('should clear the key on clear()', () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      container.clear()

      expect(container.isCleared).toBe(true)
      expect(() => container.useKeySync(() => {})).toThrow('Key has been cleared')
    })

    it('should allow async key access via useKey', async () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      const result = await container.useKey(async (key) => {
        return key.reduce((sum, byte) => sum + byte, 0)
      })

      expect(result).toBe(6) // 1 + 2 + 3

      container.clear()
    })

    it('should allow sync key access via useKeySync', () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      const result = container.useKeySync((key) => {
        return key.reduce((sum, byte) => sum + byte, 0)
      })

      expect(result).toBe(6)

      container.clear()
    })

    it('should clear key on error in useKey', async () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      await expect(
        container.useKey(async () => {
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      expect(container.isCleared).toBe(true)
    })

    it('should clear key on error in useKeySync', () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      expect(() =>
        container.useKeySync(() => {
          throw new Error('Test error')
        })
      ).toThrow('Test error')

      expect(container.isCleared).toBe(true)
    })

    it('should not allow reuse after clearing', () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      container.clear()

      expect(() => container.useKeySync(() => {})).toThrow('Key has been cleared')
    })

    it('should be safe to call clear multiple times', () => {
      const container = new SecureKeyContainer(new Uint8Array([1, 2, 3]))

      container.clear()
      expect(() => container.clear()).not.toThrow()
      expect(container.isCleared).toBe(true)
    })
  })

  describe('withSecureKey', () => {
    it('should provide key access and auto-clear on success', async () => {
      const key = new Uint8Array([1, 2, 3, 4, 5])
      let containerRef: SecureKeyContainer | null = null

      const result = await withSecureKey(key, async (container) => {
        containerRef = container
        return container.useKey(async (k) => k.length)
      })

      expect(result).toBe(5)
      expect(containerRef!.isCleared).toBe(true)
    })

    it('should auto-clear on error', async () => {
      const key = new Uint8Array([1, 2, 3])
      let containerRef: SecureKeyContainer | null = null

      await expect(
        withSecureKey(key, async (container) => {
          containerRef = container
          throw new Error('Test error')
        })
      ).rejects.toThrow('Test error')

      expect(containerRef!.isCleared).toBe(true)
    })
  })

  describe('withSecureKeySync', () => {
    it('should provide key access and auto-clear on success', () => {
      const key = new Uint8Array([1, 2, 3, 4, 5])
      let containerRef: SecureKeyContainer | null = null

      const result = withSecureKeySync(key, (container) => {
        containerRef = container
        return container.useKeySync((k) => k.length)
      })

      expect(result).toBe(5)
      expect(containerRef!.isCleared).toBe(true)
    })

    it('should auto-clear on error', () => {
      const key = new Uint8Array([1, 2, 3])
      let containerRef: SecureKeyContainer | null = null

      expect(() =>
        withSecureKeySync(key, (container) => {
          containerRef = container
          throw new Error('Test error')
        })
      ).toThrow('Test error')

      expect(containerRef!.isCleared).toBe(true)
    })
  })

  describe('deriveAlgorandAccountFromEd25519', () => {
    it('should derive the correct address from a real Algorand secret key seed', async () => {
      // Generate a real Algorand account
      const account = algosdk.generateAccount()
      const expectedAddress = account.addr.toString()

      // Extract the 32-byte seed (first 32 bytes of the 64-byte secret key)
      const seed = extractSeedFromSecretKey(account.sk)

      // Derive the account using our function
      const derived = await deriveAlgorandAccountFromEd25519(seed)

      // The derived address should match the original
      expect(derived.addr).toBe(expectedAddress)

      // The derived secret key should be 64 bytes
      expect(derived.sk.length).toBe(64)

      // The derived secret key should match the original
      expect(Array.from(derived.sk)).toEqual(Array.from(account.sk))

      // Clean up
      zeroMemory(derived.sk)
    })

    it('should work with Web3Auth-style hex private key response', async () => {
      // Generate a real Algorand account
      const account = algosdk.generateAccount()
      const expectedAddress = account.addr.toString()

      // Simulate Web3Auth returning the private key as hex
      const hexPrivateKey = simulateWeb3AuthPrivateKeyResponse(account.sk)

      // Verify it's 64 characters (32 bytes as hex)
      expect(hexPrivateKey.length).toBe(64)

      // Parse the hex back to bytes (as Web3Auth wallet would do)
      const seedBytes = hexToBytes(hexPrivateKey)

      // Derive the account
      const derived = await deriveAlgorandAccountFromEd25519(seedBytes)

      // Should produce the correct address
      expect(derived.addr).toBe(expectedAddress)

      // Clean up
      zeroMemory(derived.sk)
    })

    it('should match Web3Auth documentation approach (secretKeyToMnemonic)', async () => {
      // Generate a real Algorand account
      const account = algosdk.generateAccount()
      const expectedAddress = account.addr.toString()

      // Simulate Web3Auth returning the private key as hex (32-byte seed)
      const hexPrivateKey = simulateWeb3AuthPrivateKeyResponse(account.sk)

      // Web3Auth documentation approach:
      // var passphrase = algosdk.secretKeyToMnemonic(Buffer.from(privateKey, 'hex'))
      // var keyPair = algosdk.mnemonicToSecretKey(passphrase)
      const seedBytes = hexToBytes(hexPrivateKey)
      const mnemonic = algosdk.secretKeyToMnemonic(seedBytes)
      const web3AuthDocsKeyPair = algosdk.mnemonicToSecretKey(mnemonic)

      // Our approach using deriveAlgorandAccountFromEd25519
      const ourDerived = await deriveAlgorandAccountFromEd25519(seedBytes)

      // Both approaches should produce identical results
      expect(web3AuthDocsKeyPair.addr.toString()).toBe(expectedAddress)
      expect(ourDerived.addr).toBe(expectedAddress)
      expect(web3AuthDocsKeyPair.addr.toString()).toBe(ourDerived.addr)

      // Secret keys should also match
      expect(Array.from(web3AuthDocsKeyPair.sk)).toEqual(Array.from(ourDerived.sk))

      // Clean up
      zeroMemory(ourDerived.sk)
    })

    it('should produce valid signing keys', async () => {
      // Generate a real Algorand account
      const account = algosdk.generateAccount()
      const expectedAddress = account.addr.toString()

      // Extract seed and derive account
      const seed = extractSeedFromSecretKey(account.sk)
      const derived = await deriveAlgorandAccountFromEd25519(seed)

      // Verify derived address matches
      expect(derived.addr).toBe(expectedAddress)

      // Create a test transaction
      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: account.addr,
        suggestedParams: {
          fee: 1000,
          firstValid: 1,
          lastValid: 1000,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: {
          receiver: account.addr,
          amount: 0
        }
      })

      // Sign with original key
      const signedWithOriginal = txn.signTxn(account.sk)

      // Sign with derived key
      const signedWithDerived = txn.signTxn(derived.sk)

      // Both signatures should be identical
      expect(Array.from(signedWithOriginal)).toEqual(Array.from(signedWithDerived))

      // Both should decode successfully
      const decodedOriginal = algosdk.decodeSignedTransaction(signedWithOriginal)
      const decodedDerived = algosdk.decodeSignedTransaction(signedWithDerived)

      expect(decodedOriginal.txn.sender.toString()).toBe(expectedAddress)
      expect(decodedDerived.txn.sender.toString()).toBe(expectedAddress)

      // Clean up
      zeroMemory(derived.sk)
    })

    it('should reject invalid seed lengths', async () => {
      // Too short
      await expect(deriveAlgorandAccountFromEd25519(new Uint8Array(16))).rejects.toThrow(
        'Invalid ed25519 seed length: expected 32 bytes, got 16'
      )

      // Too long
      await expect(deriveAlgorandAccountFromEd25519(new Uint8Array(64))).rejects.toThrow(
        'Invalid ed25519 seed length: expected 32 bytes, got 64'
      )

      // Empty
      await expect(deriveAlgorandAccountFromEd25519(new Uint8Array(0))).rejects.toThrow(
        'Invalid ed25519 seed length: expected 32 bytes, got 0'
      )
    })

    it('should work with multiple accounts in sequence', async () => {
      const accounts = [
        algosdk.generateAccount(),
        algosdk.generateAccount(),
        algosdk.generateAccount()
      ]

      for (const account of accounts) {
        const seed = extractSeedFromSecretKey(account.sk)
        const derived = await deriveAlgorandAccountFromEd25519(seed)

        expect(derived.addr).toBe(account.addr.toString())

        // Clean up
        zeroMemory(derived.sk)
      }
    })

    it('should integrate with SecureKeyContainer for safe key handling', async () => {
      const account = algosdk.generateAccount()
      const seed = extractSeedFromSecretKey(account.sk)

      const container = new SecureKeyContainer(seed)
      let derivedAddress: string | null = null

      try {
        derivedAddress = await container.useKey(async (key) => {
          const derived = await deriveAlgorandAccountFromEd25519(key)
          const addr = derived.addr
          zeroMemory(derived.sk)
          return addr
        })
      } finally {
        container.clear()
      }

      expect(derivedAddress).toBe(account.addr.toString())
      expect(container.isCleared).toBe(true)
    })
  })
})
