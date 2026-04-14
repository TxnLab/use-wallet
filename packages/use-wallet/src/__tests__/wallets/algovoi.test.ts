import { Store } from '@tanstack/store'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, DEFAULT_STATE } from 'src/store'
import { AlgoVoiWallet } from 'src/wallets/algovoi'
import { WalletId } from 'src/wallets/types'
import type { Mock } from 'vitest'

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

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

// Mock AlgoVoi provider
const mockProvider = {
  id: 'algovou',
  version: '0.1.0',
  isAlgoVoi: true,
  enable: vi.fn(),
  disable: vi.fn(),
  signTransactions: vi.fn()
}

// Set up global window with AlgoVoi provider
Object.defineProperty(global, 'window', {
  value: {
    algorand: mockProvider,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  writable: true,
  configurable: true
})

function createWalletWithStore(store: Store<State>): AlgoVoiWallet {
  return new AlgoVoiWallet({
    id: WalletId.ALGOVOI,
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn()
  })
}

describe('AlgoVoiWallet', () => {
  let wallet: AlgoVoiWallet
  let store: Store<State>
  let mockInitialState: State | null = null

  const account1 = {
    name: 'AlgoVoi Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'AlgoVoi Account 2',
    address: 'mockAddress2'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockProvider.enable.mockReset()
    mockProvider.disable.mockReset()
    mockProvider.signTransactions.mockReset()

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      return null
    })

    store = new Store<State>(DEFAULT_STATE)
    wallet = createWalletWithStore(store)
  })

  afterEach(() => {
    mockInitialState = null
  })

  describe('connect', () => {
    it('should connect successfully and return accounts', async () => {
      mockProvider.enable.mockResolvedValue({
        accounts: [account1.address, account2.address]
      })

      const accounts = await wallet.connect()

      expect(mockProvider.enable).toHaveBeenCalled()
      expect(accounts).toHaveLength(2)
      expect(accounts[0].address).toBe(account1.address)
      expect(accounts[1].address).toBe(account2.address)
    })

    it('should throw if no accounts are returned', async () => {
      mockProvider.enable.mockResolvedValue({ accounts: [] })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
    })
  })

  describe('disconnect', () => {
    it('should call provider.disable and clean up state', async () => {
      mockProvider.disable.mockResolvedValue(undefined)

      // First connect
      mockProvider.enable.mockResolvedValue({ accounts: [account1.address] })
      await wallet.connect()

      // Then disconnect
      await wallet.disconnect()

      expect(mockProvider.disable).toHaveBeenCalled()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session exists', async () => {
      await wallet.resumeSession()
      expect(mockProvider.enable).not.toHaveBeenCalled()
    })

    it('should re-enable if a session exists', async () => {
      // First connect to create session state
      mockProvider.enable.mockResolvedValue({ accounts: [account1.address] })
      await wallet.connect()

      // Resume
      mockProvider.enable.mockResolvedValue({ accounts: [account1.address] })
      await wallet.resumeSession()

      expect(mockProvider.enable).toHaveBeenCalledTimes(2)
    })
  })

  describe('metadata', () => {
    it('should have correct default metadata', () => {
      expect(AlgoVoiWallet.defaultMetadata.name).toBe('AlgoVoi')
      expect(AlgoVoiWallet.defaultMetadata.icon).toContain('data:image/svg+xml;base64,')
    })
  })
})
