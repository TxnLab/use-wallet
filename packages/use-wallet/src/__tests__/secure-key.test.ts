import { describe, it, expect, vi } from 'vitest'
import {
  zeroMemory,
  zeroString,
  SecureKeyContainer,
  withSecureKey,
  withSecureKeySync
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

describe('secure-key utilities', () => {
  describe('zeroMemory', () => {
    it('should zero out a Uint8Array', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5])
      zeroMemory(buffer)

      expect(buffer.every((byte) => byte === 0)).toBe(true)
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
})
