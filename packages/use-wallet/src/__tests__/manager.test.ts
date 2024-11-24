import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { NetworkConfigBuilder } from 'src/network'
import { LOCAL_STORAGE_KEY, State, DEFAULT_STATE } from 'src/store'
import { WalletManager } from 'src/manager'
import { StorageAdapter } from 'src/storage'
import { BaseWallet } from 'src/wallets/base'
import { DeflyWallet } from 'src/wallets/defly'
import { KibisisWallet } from 'src/wallets/kibisis'
import { WalletId } from 'src/wallets/types'
import type { Mock } from 'vitest'

vi.mock('src/logger', () => {
  const mockLogger = {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
  return {
    Logger: {
      setLevel: vi.fn()
    },
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    },
    logger: mockLogger
  }
})

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

// Suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})

// Mock console.warn
let mockLoggerWarn: Mock
let mockLoggerError: Mock

beforeEach(() => {
  vi.clearAllMocks()
  mockLoggerWarn = vi.fn()
  mockLoggerError = vi.fn()
  vi.mocked(logger.createScopedLogger).mockReturnValue({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
})

vi.mock('src/wallets/defly', () => ({
  DeflyWallet: class DeflyWallet {
    constructor() {
      this.resumeSession = vi.fn().mockImplementation(() => Promise.resolve())
      this.disconnect = vi.fn().mockImplementation(() => Promise.resolve())
    }
    static defaultMetadata = {
      name: 'Defly',
      icon: 'icon-data'
    }
    resumeSession: Mock
    disconnect: Mock
    get isConnected() {
      return true
    }
  }
}))

vi.mock('src/wallets/kibisis', () => ({
  KibisisWallet: class KibisisWallet {
    constructor() {
      this.resumeSession = vi.fn().mockImplementation(() => Promise.resolve())
      this.disconnect = vi.fn().mockImplementation(() => Promise.resolve())
    }
    static defaultMetadata = {
      name: 'Kibisis',
      icon: 'icon-data'
    }
    resumeSession: Mock
    disconnect: Mock
    get isConnected() {
      return true
    }
  }
}))

const mockStore = new Store<State>(DEFAULT_STATE)

const mockDeflyWallet = new DeflyWallet({
  id: WalletId.DEFLY,
  metadata: { name: 'Defly', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn(),
  networks: {}
})

const mockKibisisWallet = new KibisisWallet({
  id: WalletId.KIBISIS,
  metadata: { name: 'Kibisis', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn(),
  networks: {}
})

describe('WalletManager', () => {
  let mockInitialState: State | null = null

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      return null
    })

    // Reset to null before each test
    mockInitialState = null
  })

  describe('constructor', () => {
    it('initializes with default networks', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.wallets.length).toBe(2)
      expect(manager.activeNetwork).toBe('testnet')
      expect(manager.networks).toHaveProperty('mainnet')
      expect(manager.networks).toHaveProperty('testnet')
      expect(manager.networks).toHaveProperty('betanet')
      expect(manager.networks).toHaveProperty('fnet')
      expect(manager.networks).toHaveProperty('localnet')
    })

    it('initializes with custom network configurations', () => {
      const networks = new NetworkConfigBuilder()
        .mainnet({
          token: 'custom-token',
          baseServer: 'https://custom-server.com',
          headers: { 'X-API-Key': 'key' }
        })
        .build()

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS],
        networks,
        defaultNetwork: 'mainnet'
      })

      expect(manager.activeNetwork).toBe('mainnet')
      expect(manager.networks.mainnet.algod).toEqual({
        token: 'custom-token',
        baseServer: 'https://custom-server.com',
        headers: { 'X-API-Key': 'key' }
      })
    })

    it('initializes with custom network', () => {
      const networks = new NetworkConfigBuilder()
        .addNetwork('custom', {
          name: 'Custom Network',
          algod: {
            token: 'token',
            baseServer: 'https://custom-network.com',
            headers: {}
          },
          isTestnet: true
        })
        .build()

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS],
        networks,
        defaultNetwork: 'custom'
      })

      expect(manager.activeNetwork).toBe('custom')
      expect(manager.networks.custom).toBeDefined()
    })
  })

  describe('initializeWallets', () => {
    it('initializes wallets from string array', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets from WalletIdConfig array', () => {
      const manager = new WalletManager({
        wallets: [
          {
            id: WalletId.PERA
          },
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: '1234'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets from mixed array', () => {
      const manager = new WalletManager({
        wallets: [
          WalletId.DEFLY,
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: '1234'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets with custom metadata', () => {
      const manager = new WalletManager({
        wallets: [
          {
            id: WalletId.DEFLY,
            metadata: {
              name: 'Custom Wallet',
              icon: 'icon'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(1)
      expect(manager.wallets[0]?.metadata.name).toBe('Custom Wallet')
      expect(manager.wallets[0]?.metadata.icon).toBe('icon')
    })

    // @todo: Test for handling of invalid wallet configurations
  })

  describe('setActiveNetwork', () => {
    it('sets active network correctly', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      await manager.setActiveNetwork('mainnet')
      expect(manager.activeNetwork).toBe('mainnet')
    })

    it('throws error for invalid network', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      await expect(manager.setActiveNetwork('invalid')).rejects.toThrow(
        'Network "invalid" not found in network configuration'
      )
    })
  })

  describe('subscribe', () => {
    it('adds and removes a subscriber', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      const callback = vi.fn()
      const unsubscribe = manager.subscribe(callback)

      // Trigger a state change
      await manager.setActiveNetwork('mainnet')

      expect(callback).toHaveBeenCalled()

      unsubscribe()
      // Trigger another state change
      manager.setActiveNetwork('betanet')

      expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
    })
  })

  describe('loadPersistedState', () => {
    beforeEach(() => {
      mockInitialState = {
        wallets: {
          [WalletId.KIBISIS]: {
            accounts: [
              {
                name: 'Kibisis 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Kibisis 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: WalletId.KIBISIS,
        activeNetwork: 'betanet',
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/')
      }
    })

    it('loads persisted state correctly', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      // expect(manager.store.state).toEqual(mockInitialState)
      expect(manager.activeWallet?.id).toBe(WalletId.KIBISIS)
      expect(manager.activeNetwork).toBe('betanet')
    })

    it('returns null if no persisted state', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      // Store initializes with default state if null is returned
      expect(manager.store.state).toEqual(DEFAULT_STATE)
      expect(manager.activeWallet).toBeNull()
      expect(manager.activeNetwork).toBe('testnet')
    })

    it('returns null and logs warning and error if persisted state is invalid', () => {
      const invalidState = { invalid: 'state' }
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(JSON.stringify(invalidState))

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      expect(mockLoggerWarn).toHaveBeenCalledWith('Parsed state:', invalidState)
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Could not load state from local storage: Persisted state is invalid'
      )
      // Store initializes with default state if null is returned
      expect(manager.store.state).toEqual(DEFAULT_STATE)
    })
  })

  describe('savePersistedState', () => {
    it('saves state to local storage', async () => {
      const stateToSave: Omit<State, 'algodClient'> = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'mainnet'
      }

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      await manager.setActiveNetwork('mainnet')

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(stateToSave)
      )
    })
  })

  describe('activeWallet', () => {
    beforeEach(() => {
      mockInitialState = {
        wallets: {
          [WalletId.KIBISIS]: {
            accounts: [
              {
                name: 'Kibisis 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Kibisis 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: WalletId.KIBISIS,
        activeNetwork: 'betanet',
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/')
      }
    })

    it('returns the active wallet', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.activeWallet?.id).toBe(WalletId.KIBISIS)
    })

    it('returns null if no active wallet', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.activeWallet).toBeNull()
    })

    it('returns active wallet accounts', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.activeWalletAccounts?.length).toBe(1)
      expect(manager.activeWalletAddresses).toEqual([
        '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
      ])
    })

    it('removes wallets in state that are not in config', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })
      expect(manager.wallets.length).toBe(1)
      expect(manager.wallets[0]?.id).toBe(WalletId.DEFLY)
      expect(manager.activeWallet).toBeNull()
    })
  })

  describe('Transaction Signing', () => {
    it('throws error if no active wallet', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(() => manager.signTransactions).toThrow()
    })

    // @todo: Tests for successful signing
  })

  describe('resumeSessions', () => {
    it('resumes sessions for all wallets', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])
      await manager.resumeSessions()

      const deflyResumeSessionMock = mockDeflyWallet.resumeSession as Mock
      const kibisisResumeSessionMock = mockKibisisWallet.resumeSession as Mock

      expect(deflyResumeSessionMock).toHaveBeenCalled()
      expect(kibisisResumeSessionMock).toHaveBeenCalled()

      const calls = [
        deflyResumeSessionMock.mock.calls.length,
        kibisisResumeSessionMock.mock.calls.length
      ]
      expect(calls).toEqual([1, 1])
    })
  })

  describe('disconnect', () => {
    it('disconnects all connected wallets', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])

      // Mock isConnected to return true for the test
      vi.spyOn(mockDeflyWallet, 'isConnected', 'get').mockReturnValue(true)
      vi.spyOn(mockKibisisWallet, 'isConnected', 'get').mockReturnValue(true)

      const deflyDisconnectMock = mockDeflyWallet.disconnect as Mock
      const kibisisDisconnectMock = mockKibisisWallet.disconnect as Mock

      await manager.disconnect()

      expect(deflyDisconnectMock).toHaveBeenCalled()
      expect(kibisisDisconnectMock).toHaveBeenCalled()
    })

    it('does not call disconnect on wallets that are not connected', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])

      // Mock isConnected to return false for the test
      vi.spyOn(mockDeflyWallet, 'isConnected', 'get').mockReturnValue(false)
      vi.spyOn(mockKibisisWallet, 'isConnected', 'get').mockReturnValue(false)

      const deflyDisconnectMock = mockDeflyWallet.disconnect as Mock
      const kibisisDisconnectMock = mockKibisisWallet.disconnect as Mock

      await manager.disconnect()

      expect(deflyDisconnectMock).not.toHaveBeenCalled()
      expect(kibisisDisconnectMock).not.toHaveBeenCalled()
    })
  })

  describe('options', () => {
    describe('resetNetwork', () => {
      let mockInitialState: State | null = null

      beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
          if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
            return JSON.stringify(mockInitialState)
          }
          return null
        })

        // Reset to null before each test
        mockInitialState = null
      })

      it('uses the default network when resetNetwork is true, ignoring persisted state', () => {
        mockInitialState = {
          wallets: {},
          activeWallet: null,
          activeNetwork: 'mainnet',
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev')
        }

        const manager = new WalletManager({
          wallets: [],
          defaultNetwork: 'testnet',
          options: { resetNetwork: true }
        })

        expect(manager.activeNetwork).toBe('testnet')
      })

      it('uses the persisted network when resetNetwork is false', () => {
        mockInitialState = {
          wallets: {},
          activeWallet: null,
          activeNetwork: 'mainnet',
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev')
        }

        const manager = new WalletManager({
          wallets: [],
          defaultNetwork: 'testnet',
          options: { resetNetwork: false }
        })

        expect(manager.activeNetwork).toBe('mainnet')
      })

      it('uses the default network when resetNetwork is false and no persisted state exists', () => {
        const manager = new WalletManager({
          wallets: [],
          defaultNetwork: 'testnet',
          options: { resetNetwork: false }
        })

        expect(manager.activeNetwork).toBe('testnet')
      })

      it('preserves wallet state when resetNetwork is true, only changing the network', () => {
        mockInitialState = {
          wallets: {
            [WalletId.PERA]: {
              accounts: [{ name: 'Account 1', address: 'address1' }],
              activeAccount: { name: 'Account 1', address: 'address1' }
            }
          },
          activeWallet: WalletId.PERA,
          activeNetwork: 'mainnet',
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev')
        }

        const manager = new WalletManager({
          wallets: [WalletId.PERA],
          defaultNetwork: 'testnet',
          options: { resetNetwork: true }
        })

        // Check that the network is forced to testnet
        expect(manager.activeNetwork).toBe('testnet')

        // Check that the wallet state is preserved
        expect(manager.store.state.wallets[WalletId.PERA]).toEqual({
          accounts: [{ name: 'Account 1', address: 'address1' }],
          activeAccount: { name: 'Account 1', address: 'address1' }
        })
        expect(manager.store.state.activeWallet).toBe(WalletId.PERA)
      })
    })
  })
})
