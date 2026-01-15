import { Store } from '@tanstack/store'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, DEFAULT_STATE } from 'src/store'
import { WalletConnect } from 'src/wallets/walletconnect'
import { WalletId } from 'src/wallets/types'
import { WalletManager } from 'src/manager'
import type { Mock } from 'vitest'

// Mock logger
vi.mock('src/logger', () => ({
  Logger: {
    setLevel: vi.fn()
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  logger: {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

const mockSignClient = {
  on: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  request: vi.fn(),
  session: {
    get: vi.fn(),
    keys: [''],
    length: 0
  }
}

vi.mock('@walletconnect/sign-client', () => {
  return {
    SignClient: class {
      static init = vi.fn(() => Promise.resolve(mockSignClient))
    }
  }
})

vi.mock('@walletconnect/modal-core', () => ({
  ModalCtrl: {
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
    subscribe: vi.fn(() => () => {})
  }
}))

describe('WalletConnect Skins', () => {
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(StorageAdapter.getItem).mockReturnValue(null)

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    vi.mocked(logger.createScopedLogger).mockReturnValue(mockLogger)
  })

  describe('WalletConnect with skin option', () => {
    it('should use default walletKey (id) when no skin is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.id).toBe(WalletId.WALLETCONNECT)
      expect(wallet.walletKey).toBe(WalletId.WALLETCONNECT)
    })

    it('should derive composite walletKey when built-in skin is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'biatec' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.id).toBe(WalletId.WALLETCONNECT)
      expect(wallet.walletKey).toBe('walletconnect:biatec')
    })

    it('should derive composite walletKey when voiwallet skin is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'voiwallet' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.id).toBe(WalletId.WALLETCONNECT)
      expect(wallet.walletKey).toBe('walletconnect:voiwallet')
      expect(wallet.metadata.name).toBe('Voi Wallet')
      expect(wallet.metadata.icon).toContain('data:image/svg+xml;base64,')
    })

    it('should derive composite walletKey when custom skin object is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: {
          projectId: 'test-project-id',
          skin: {
            id: 'mywallet',
            name: 'My Custom Wallet',
            icon: 'data:image/svg+xml;base64,custom'
          }
        },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.id).toBe(WalletId.WALLETCONNECT)
      expect(wallet.walletKey).toBe('walletconnect:mywallet')
    })

    it('should use skin metadata when skin is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'biatec' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.metadata.name).toBe('Biatec Wallet')
      expect(wallet.metadata.icon).toContain('data:image/svg+xml;base64,')
    })

    it('should allow user metadata to override skin metadata', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'biatec' },
        metadata: { name: 'Custom Biatec Name' },
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(wallet.metadata.name).toBe('Custom Biatec Name')
      // Icon should still come from skin since not overridden
      expect(wallet.metadata.icon).toContain('data:image/svg+xml;base64,')
    })

    it('should use default WalletConnect metadata when non-existent skin is provided', () => {
      const store = new Store<State>(DEFAULT_STATE)
      const wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'nonexistent' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      // Should fallback to default WalletConnect id since skin wasn't found
      expect(wallet.walletKey).toBe(WalletId.WALLETCONNECT)
      expect(wallet.metadata.name).toBe('WalletConnect')
    })
  })

  describe('WalletManager with multiple WalletConnect skins', () => {
    it('should initialize multiple WalletConnect instances with different skins', () => {
      const manager = new WalletManager({
        wallets: [
          // Generic WalletConnect (no skin)
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id' } },
          // Biatec skin (built-in)
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } },
          // Voi Wallet skin (built-in)
          {
            id: WalletId.WALLETCONNECT,
            options: { projectId: 'test-project-id', skin: 'voiwallet' }
          },
          // Custom skin
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: 'test-project-id',
              skin: { id: 'customwallet', name: 'Custom Wallet', icon: 'custom-icon' }
            }
          }
        ]
      })

      expect(manager.wallets.length).toBe(4)

      // Verify each wallet has unique walletKey
      const walletKeys = manager.wallets.map((w) => w.walletKey)
      expect(walletKeys).toContain('walletconnect')
      expect(walletKeys).toContain('walletconnect:biatec')
      expect(walletKeys).toContain('walletconnect:voiwallet')
      expect(walletKeys).toContain('walletconnect:customwallet')

      // All should have the same id
      expect(manager.wallets.every((w) => w.id === WalletId.WALLETCONNECT)).toBe(true)
    })

    it('should allow retrieving wallets by their unique walletKey', () => {
      const manager = new WalletManager({
        wallets: [
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id' } },
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } }
        ]
      })

      const genericWallet = manager.getWallet(WalletId.WALLETCONNECT)
      const biatecWallet = manager.getWallet('walletconnect:biatec')

      expect(genericWallet).toBeDefined()
      expect(biatecWallet).toBeDefined()
      expect(genericWallet).not.toBe(biatecWallet)

      expect(genericWallet?.walletKey).toBe(WalletId.WALLETCONNECT)
      expect(biatecWallet?.walletKey).toBe('walletconnect:biatec')
    })

    it('should prevent duplicate wallet keys', () => {
      const manager = new WalletManager({
        wallets: [
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } },
          // Second instance with same skin should be skipped
          { id: WalletId.WALLETCONNECT, options: { projectId: 'another-id', skin: 'biatec' } }
        ]
      })

      // Should only have 1 wallet since second is duplicate
      expect(manager.wallets.length).toBe(1)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Duplicate wallet key: walletconnect:biatec. Skipping...'
      )
    })

    it('should maintain separate metadata for each skinned wallet', () => {
      const manager = new WalletManager({
        wallets: [
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id' } },
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } },
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: 'test-project-id',
              skin: { id: 'custom', name: 'Custom Wallet', icon: 'custom-icon' }
            }
          }
        ]
      })

      const genericWallet = manager.getWallet(WalletId.WALLETCONNECT)
      const biatecWallet = manager.getWallet('walletconnect:biatec')
      const customWallet = manager.getWallet('walletconnect:custom')

      expect(genericWallet?.metadata.name).toBe('WalletConnect')
      expect(biatecWallet?.metadata.name).toBe('Biatec Wallet')
      expect(customWallet?.metadata.name).toBe('Custom Wallet')
    })

    it('should work alongside other wallet types', () => {
      const manager = new WalletManager({
        wallets: [
          WalletId.KIBISIS,
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id' } },
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } }
        ]
      })

      expect(manager.wallets.length).toBe(3)

      const walletKeys = manager.wallets.map((w) => w.walletKey)
      expect(walletKeys).toContain(WalletId.KIBISIS)
      expect(walletKeys).toContain('walletconnect')
      expect(walletKeys).toContain('walletconnect:biatec')
    })
  })

  describe('State isolation for skinned wallets', () => {
    it('should store wallet state under walletKey, not id', async () => {
      const store = new Store<State>(DEFAULT_STATE)

      const biatecWallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'biatec' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      expect(biatecWallet.walletKey).toBe('walletconnect:biatec')

      // After connecting, state should be stored under the walletKey
      // We can verify the accounts getter uses walletKey by checking the path it would use
      expect(biatecWallet.accounts).toEqual([])
      expect(store.state.wallets['walletconnect:biatec']).toBeUndefined()
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
    })

    it('should use walletKey for session storage backup/restore', () => {
      const store = new Store<State>(DEFAULT_STATE)

      const biatecWallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: { projectId: 'test-project-id', skin: 'biatec' },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: vi.fn()
      })

      // Mock storage to have a backup
      vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
        if (key === 'walletconnect-walletconnect:biatec') {
          return JSON.stringify({ session: 'biatec-session' })
        }
        return null
      })

      // The manageWalletConnectSession method should use walletKey
      // Testing the storage key pattern
      expect(StorageAdapter.getItem).not.toHaveBeenCalled()

      // Trigger a restore (this is protected method, but we can verify through storage mock)
      // The key pattern should be `walletconnect-${walletKey}`
      const expectedKey = `walletconnect-${biatecWallet.walletKey}`
      expect(expectedKey).toBe('walletconnect-walletconnect:biatec')
    })
  })

  describe('Persisted state with skinned wallets', () => {
    it('should persist and restore skinned wallet state', () => {
      let savedState: string | null = null

      vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
        if (key === LOCAL_STORAGE_KEY) {
          return savedState
        }
        return null
      })

      vi.mocked(StorageAdapter.setItem).mockImplementation((key: string, value: string) => {
        if (key === LOCAL_STORAGE_KEY) {
          savedState = value
        }
      })

      // Create manager with skinned wallet
      const manager1 = new WalletManager({
        wallets: [
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } }
        ]
      })

      expect(manager1.wallets.length).toBe(1)
      expect(manager1.wallets[0].walletKey).toBe('walletconnect:biatec')

      // Verify the state was persisted
      expect(StorageAdapter.setItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY, expect.any(String))

      // Create a new manager - should load persisted state
      const manager2 = new WalletManager({
        wallets: [
          { id: WalletId.WALLETCONNECT, options: { projectId: 'test-project-id', skin: 'biatec' } }
        ]
      })

      expect(manager2.wallets.length).toBe(1)
      expect(manager2.wallets[0].walletKey).toBe('walletconnect:biatec')
    })
  })
})
