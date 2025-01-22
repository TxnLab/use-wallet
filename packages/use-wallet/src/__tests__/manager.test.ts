import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { createNetworkConfig, DEFAULT_NETWORK_CONFIG, NetworkConfigBuilder } from 'src/network'
import { LOCAL_STORAGE_KEY, PersistedState, State, DEFAULT_STATE } from 'src/store'
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
  subscribe: vi.fn()
})

const mockKibisisWallet = new KibisisWallet({
  id: WalletId.KIBISIS,
  metadata: { name: 'Kibisis', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn()
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
      expect(manager.networkConfig).toHaveProperty('mainnet')
      expect(manager.networkConfig).toHaveProperty('testnet')
      expect(manager.networkConfig).toHaveProperty('betanet')
      expect(manager.networkConfig).toHaveProperty('fnet')
      expect(manager.networkConfig).toHaveProperty('localnet')
    })

    it('initializes with custom network configurations', () => {
      const networks = new NetworkConfigBuilder()
        .mainnet({
          algod: {
            token: 'custom-token',
            baseServer: 'https://custom-server.com',
            headers: { 'X-API-Key': 'key' }
          }
        })
        .build()

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS],
        networks,
        defaultNetwork: 'mainnet'
      })

      expect(manager.activeNetwork).toBe('mainnet')
      expect(manager.networkConfig.mainnet.algod).toEqual({
        token: 'custom-token',
        baseServer: 'https://custom-server.com',
        headers: { 'X-API-Key': 'key' }
      })
    })

    it('initializes with custom network', () => {
      const networks = new NetworkConfigBuilder()
        .addNetwork('custom', {
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
      expect(manager.networkConfig.custom).toBeDefined()
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

  describe('updateAlgodConfig', () => {
    it('updates algod configuration for a network', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      const newConfig = {
        token: 'new-token',
        baseServer: 'https://new-server.com',
        port: '443',
        headers: { 'X-API-Key': 'new-key' }
      }

      manager.updateAlgodConfig('mainnet', newConfig)

      expect(manager.networkConfig.mainnet.algod).toEqual(newConfig)
    })

    it('updates active algod client when modifying active network', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS],
        defaultNetwork: 'mainnet'
      })

      const initialClient = manager.algodClient
      const newConfig = {
        token: 'new-token',
        baseServer: 'https://new-server.com'
      }

      manager.updateAlgodConfig('mainnet', newConfig)

      expect(manager.algodClient).not.toBe(initialClient)
      expect(manager.networkConfig.mainnet.algod.token).toBe('new-token')
      expect(manager.networkConfig.mainnet.algod.baseServer).toBe('https://new-server.com')
    })

    it('does not update algod client when modifying inactive network', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS],
        defaultNetwork: 'mainnet'
      })

      const initialClient = manager.algodClient
      const newConfig = {
        token: 'new-token',
        baseServer: 'https://new-server.com'
      }

      manager.updateAlgodConfig('testnet', newConfig)

      expect(manager.algodClient).toBe(initialClient)
      expect(manager.networkConfig.testnet.algod.token).toBe('new-token')
      expect(manager.networkConfig.testnet.algod.baseServer).toBe('https://new-server.com')
    })

    it('throws error for non-existent network', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      expect(() =>
        manager.updateAlgodConfig('invalid-network', {
          token: 'new-token',
          baseServer: 'https://new-server.com'
        })
      ).toThrow('Network "invalid-network" not found in network configuration')
    })

    it('throws error for invalid configuration', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      expect(() =>
        manager.updateAlgodConfig('mainnet', {
          token: 'new-token',
          // @ts-expect-error Testing invalid config
          baseServer: 123 // Invalid type for baseServer
        })
      ).toThrow('Invalid network configuration')
    })

    it('preserves existing configuration when partially updating', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })

      const initialConfig = { ...manager.networkConfig.mainnet.algod }
      manager.updateAlgodConfig('mainnet', {
        token: 'new-token'
      })

      expect(manager.networkConfig.mainnet.algod).toEqual({
        ...initialConfig,
        token: 'new-token'
      })
    })
  })

  describe('resetNetworkConfig', () => {
    it('resets network configuration to base config', () => {
      // Set up initial state with custom network config
      mockInitialState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {
          mainnet: {
            algod: {
              token: 'custom-token',
              baseServer: 'https://custom-server.com'
            }
          }
        }
      }

      const manager = new WalletManager({
        networks: DEFAULT_NETWORK_CONFIG
      })

      // Verify custom config is loaded
      expect(manager.networkConfig.mainnet.algod.token).toBe('custom-token')
      expect(manager.networkConfig.mainnet.algod.baseServer).toBe('https://custom-server.com')

      // Reset the network config
      manager.resetNetworkConfig('mainnet')

      // Verify config is reset to base values
      expect(manager.networkConfig.mainnet).toEqual(DEFAULT_NETWORK_CONFIG.mainnet)

      // Verify persisted state is updated
      const lastCall = vi.mocked(StorageAdapter.setItem).mock.lastCall
      const persistedState = JSON.parse(lastCall?.[1] || '{}')
      expect(persistedState.customNetworkConfigs.mainnet).toBeUndefined()
    })

    it('throws error when resetting non-existent network', () => {
      const manager = new WalletManager()
      expect(() => manager.resetNetworkConfig('invalid-network')).toThrow(
        'Network "invalid-network" not found in network configuration'
      )
    })

    it('updates algod client when resetting active network', () => {
      // Set up initial state with custom mainnet config as active network
      mockInitialState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'mainnet',
        algodClient: new algosdk.Algodv2('', 'https://custom-server.com'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {
          mainnet: {
            algod: {
              token: 'custom-token',
              baseServer: 'https://custom-server.com'
            }
          }
        }
      }

      const manager = new WalletManager()
      const createAlgodClientSpy = vi.spyOn(manager as any, 'createAlgodClient')

      manager.resetNetworkConfig('mainnet')

      expect(createAlgodClientSpy).toHaveBeenCalledWith(DEFAULT_NETWORK_CONFIG.mainnet.algod)
      expect(manager.algodClient).toBeDefined()
    })
  })

  describe('activeNetworkConfig', () => {
    it('returns the configuration for the active network', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY],
        defaultNetwork: 'mainnet'
      })

      expect(manager.activeNetworkConfig).toBe(manager.networkConfig.mainnet)
    })

    it('updates when active network changes', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY],
        defaultNetwork: 'mainnet'
      })

      const mainnetConfig = manager.activeNetworkConfig
      await manager.setActiveNetwork('testnet')

      expect(manager.activeNetworkConfig).toBe(manager.networkConfig.testnet)
      expect(manager.activeNetworkConfig).not.toBe(mainnetConfig)
    })

    it('updates when network configuration changes', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY],
        defaultNetwork: 'mainnet'
      })

      const newConfig = {
        token: 'new-token',
        baseServer: 'https://new-server.com'
      }

      manager.updateAlgodConfig('mainnet', newConfig)
      expect(manager.activeNetworkConfig.algod).toMatchObject(newConfig)
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
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
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
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      await manager.setActiveNetwork('mainnet')

      const expectedState: PersistedState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'mainnet',
        customNetworkConfigs: {}
      }

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(expectedState)
      )
    })

    it('persists custom network configurations', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })

      const customAlgod = {
        token: 'custom-token',
        baseServer: 'https://custom-server.com',
        headers: { 'X-API-Key': 'custom-key' },
        port: '443'
      }

      manager.updateAlgodConfig('mainnet', customAlgod)

      // Verify the persisted state includes the custom network config
      const expectedState: PersistedState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        customNetworkConfigs: {
          mainnet: {
            algod: customAlgod
          }
        }
      }

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenLastCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(expectedState)
      )
    })

    it('only persists modified network configurations', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })

      // Get the default config for comparison
      const defaultConfig = createNetworkConfig()

      // Update only one property
      manager.updateAlgodConfig('mainnet', {
        token: 'custom-token'
      })

      // The persisted state should only include the modified property
      const expectedState: PersistedState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        customNetworkConfigs: {
          mainnet: {
            algod: {
              ...defaultConfig.mainnet.algod,
              token: 'custom-token'
            }
          }
        }
      }

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(expectedState)
      )
    })

    it('removes network from customNetworkConfigs when reset to default', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })

      // Get the default config
      const defaultConfig = createNetworkConfig()

      // First modify the network
      manager.updateAlgodConfig('mainnet', {
        token: 'custom-token'
      })

      // Then reset it back to default
      manager.updateAlgodConfig('mainnet', defaultConfig.mainnet.algod)

      // The persisted state should not include mainnet in customNetworkConfigs
      const expectedState: PersistedState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        customNetworkConfigs: {}
      }

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenLastCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(expectedState)
      )
    })
  })

  describe('network configuration persistence', () => {
    it('loads persisted network configurations on initialization', () => {
      mockInitialState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {
          mainnet: {
            algod: {
              token: 'persisted-token',
              baseServer: 'https://mainnet-api.4160.nodely.dev',
              headers: {},
              port: ''
            },
            isTestnet: false,
            genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
            genesisId: 'mainnet-v1.0',
            caipChainId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
          }
        }
      }

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })

      // Verify the custom config was loaded
      expect(manager.networkConfig.mainnet.algod).toEqual(
        mockInitialState.customNetworkConfigs.mainnet.algod
      )
    })

    it('merges persisted configurations with provided configurations', () => {
      mockInitialState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {
          mainnet: {
            algod: {
              token: 'persisted-token',
              baseServer: 'https://persisted-server.com',
              headers: {},
              port: ''
            },
            isTestnet: false,
            genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
            genesisId: 'mainnet-v1.0',
            caipChainId: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
          }
        }
      }

      // Provide configuration in constructor with different baseServer
      const providedNetworks = {
        mainnet: {
          ...DEFAULT_NETWORK_CONFIG.mainnet,
          algod: {
            ...DEFAULT_NETWORK_CONFIG.mainnet.algod,
            baseServer: 'https://provided-server.com'
          }
        },
        testnet: DEFAULT_NETWORK_CONFIG.testnet,
        betanet: DEFAULT_NETWORK_CONFIG.betanet,
        fnet: DEFAULT_NETWORK_CONFIG.fnet,
        localnet: DEFAULT_NETWORK_CONFIG.localnet
      }

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY],
        networks: providedNetworks
      })

      // Verify the configs were merged correctly, with persisted taking precedence
      expect(manager.networkConfig.mainnet.algod).toEqual({
        token: 'persisted-token',
        baseServer: 'https://persisted-server.com',
        headers: {},
        port: ''
      })
    })

    it('does not persist developer-provided configurations', () => {
      // Provide custom configuration in constructor
      const providedNetworks = {
        mainnet: {
          algod: {
            ...DEFAULT_NETWORK_CONFIG.mainnet.algod,
            baseServer: 'https://custom-server.com'
          }
        }
      }

      const manager = new WalletManager({
        networks: providedNetworks,
        defaultNetwork: 'mainnet'
      })

      // Get the last persisted state
      const lastCall = vi.mocked(StorageAdapter.setItem).mock.lastCall
      const persistedState = JSON.parse(lastCall?.[1] || '{}')

      // Verify that the developer's custom configuration wasn't persisted
      expect(persistedState.customNetworkConfigs).toEqual({})

      // Now update the network config through the manager
      manager.updateAlgodConfig('mainnet', {
        baseServer: 'https://user-server.com'
      })

      // Get the updated persisted state
      const updatedCall = vi.mocked(StorageAdapter.setItem).mock.lastCall
      const updatedState = JSON.parse(updatedCall?.[1] || '{}')

      // Verify that only the user's modification was persisted
      expect(updatedState.customNetworkConfigs.mainnet.algod).toEqual({
        token: '',
        baseServer: 'https://user-server.com',
        headers: {}
      })
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
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
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

  describe('status', () => {
    it('returns initializing by default', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      expect(manager.status).toBe('initializing')
      expect(manager.isReady).toBe(false)
    })

    it('changes to ready after resumeSessions', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])

      expect(manager.status).toBe('initializing')
      await manager.resumeSessions()
      expect(manager.status).toBe('ready')
      expect(manager.isReady).toBe(true)
    })

    it('changes to ready after resumeSessions even if it fails', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])

      // Mock one of the wallets to throw an error
      vi.mocked(mockDeflyWallet.resumeSession).mockRejectedValueOnce(
        new Error('Failed to resume session')
      )

      expect(manager.status).toBe('initializing')
      await expect(manager.resumeSessions()).rejects.toThrow('Failed to resume session')
      expect(manager.status).toBe('ready')
      expect(manager.isReady).toBe(true)
    })
  })

  describe('resumeSessions', () => {
    it('resumes sessions for all wallets and updates status', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.KIBISIS]
      })
      manager._clients = new Map<WalletId, BaseWallet>([
        [WalletId.DEFLY, mockDeflyWallet],
        [WalletId.KIBISIS, mockKibisisWallet]
      ])

      expect(manager.status).toBe('initializing')
      await manager.resumeSessions()

      const deflyResumeSessionMock = mockDeflyWallet.resumeSession as Mock
      const kibisisResumeSessionMock = mockKibisisWallet.resumeSession as Mock

      expect(deflyResumeSessionMock).toHaveBeenCalled()
      expect(kibisisResumeSessionMock).toHaveBeenCalled()
      expect(manager.status).toBe('ready')

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
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev'),
          managerStatus: 'ready',
          networkConfig: DEFAULT_NETWORK_CONFIG,
          customNetworkConfigs: {}
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
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev'),
          managerStatus: 'ready',
          networkConfig: DEFAULT_NETWORK_CONFIG,
          customNetworkConfigs: {}
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
          algodClient: new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev'),
          managerStatus: 'ready',
          networkConfig: DEFAULT_NETWORK_CONFIG,
          customNetworkConfigs: {}
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
