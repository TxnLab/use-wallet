import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { DEFAULT_NETWORK_CONFIG, NetworkConfigBuilder } from 'src/network'
import {
  LOCAL_STORAGE_KEY,
  PersistedState,
  State,
  DEFAULT_STATE,
  addWallet,
  removeWallet,
  setActiveAccount,
  setActiveWallet
} from 'src/store'
import { WalletManager } from 'src/manager'
import { StorageAdapter } from 'src/storage'
import { BaseWallet } from 'src/wallets/base'
import type { AdapterConstructorParams, WalletAdapterConfig } from 'src/wallets/types'
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

// ---------- Test adapter classes ----------------------------------- //

class MockDeflyAdapter extends BaseWallet {
  static defaultMetadata = { name: 'Defly', icon: 'icon-data' }
  public resumeSession = vi.fn().mockResolvedValue(undefined)
  public disconnect = vi.fn().mockResolvedValue(undefined)
  public connect = vi.fn().mockResolvedValue([])
  public signTransactions = vi.fn().mockResolvedValue([])

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

class MockKibisisAdapter extends BaseWallet {
  static defaultMetadata = { name: 'Kibisis', icon: 'icon-data' }
  public resumeSession = vi.fn().mockResolvedValue(undefined)
  public disconnect = vi.fn().mockResolvedValue(undefined)
  public connect = vi.fn().mockResolvedValue([])
  public signTransactions = vi.fn().mockResolvedValue([])

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

// ---------- Factory functions -------------------------------------- //

function defly(): WalletAdapterConfig {
  return {
    id: 'defly',
    metadata: MockDeflyAdapter.defaultMetadata,
    Adapter: MockDeflyAdapter
  }
}

function kibisis(): WalletAdapterConfig {
  return {
    id: 'kibisis',
    metadata: MockKibisisAdapter.defaultMetadata,
    Adapter: MockKibisisAdapter
  }
}

class MockMnemonicAdapter extends BaseWallet {
  static defaultMetadata = { name: 'Mnemonic', icon: 'icon-data' }
  public resumeSession = vi.fn().mockResolvedValue(undefined)
  public disconnect = vi.fn().mockResolvedValue(undefined)
  public connect = vi.fn().mockResolvedValue([])
  public signTransactions = vi.fn().mockResolvedValue([])

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

class MockExodusAdapter extends BaseWallet {
  static defaultMetadata = { name: 'Exodus', icon: 'icon-data' }
  public resumeSession = vi.fn().mockResolvedValue(undefined)
  public disconnect = vi.fn().mockResolvedValue(undefined)
  public connect = vi.fn().mockResolvedValue([])
  public signTransactions = vi.fn().mockResolvedValue([])

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

function mnemonicAdapter(): WalletAdapterConfig {
  return {
    id: 'mnemonic',
    metadata: MockMnemonicAdapter.defaultMetadata,
    Adapter: MockMnemonicAdapter,
    capabilities: { excludedNetworks: ['mainnet'] }
  }
}

function exodusAdapter(): WalletAdapterConfig {
  return {
    id: 'exodus',
    metadata: MockExodusAdapter.defaultMetadata,
    Adapter: MockExodusAdapter,
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

function deflyWithCapabilities(): WalletAdapterConfig {
  return {
    id: 'defly',
    metadata: MockDeflyAdapter.defaultMetadata,
    Adapter: MockDeflyAdapter,
    capabilities: { supportedNetworks: ['mainnet', 'testnet'] }
  }
}

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
        wallets: [defly(), kibisis()]
      })
      expect(manager.wallets.length).toBe(2)
      expect(manager.activeNetwork).toBe('testnet')
      expect(manager.networkConfig).toHaveProperty('mainnet')
      expect(manager.networkConfig).toHaveProperty('testnet')
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
        wallets: [defly(), kibisis()],
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
  })

  describe('initializeWallets', () => {
    it('initializes wallets from WalletAdapterConfig array', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('skips duplicate wallet keys', () => {
      const manager = new WalletManager({
        wallets: [defly(), defly()]
      })
      expect(manager.wallets.length).toBe(1)
    })
  })

  describe('setActiveNetwork', () => {
    it('sets active network correctly', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      await manager.setActiveNetwork('mainnet')
      expect(manager.activeNetwork).toBe('mainnet')
    })

    it('throws error for invalid network', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      await expect(manager.setActiveNetwork('invalid')).rejects.toThrow(
        'Network "invalid" not found in network configuration'
      )
    })
  })

  describe('updateAlgodConfig', () => {
    it('updates algod configuration for a network', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
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

    it('throws error for non-existent network', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      expect(() =>
        manager.updateAlgodConfig('invalid-network', {
          token: 'new-token',
          baseServer: 'https://new-server.com'
        })
      ).toThrow('Network "invalid-network" not found in network configuration')
    })
  })

  describe('subscribe', () => {
    it('adds and removes a subscriber', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
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
          kibisis: {
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
        activeWallet: 'kibisis',
        activeNetwork: 'betanet',
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }
    })

    it('loads persisted state correctly', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()],
        options: { persistNetwork: true }
      })
      expect(manager.activeWallet?.id).toBe('kibisis')
      expect(manager.activeNetwork).toBe('betanet')
    })

    it('returns null if no persisted state', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      expect(manager.store.state).toEqual(DEFAULT_STATE)
      expect(manager.activeWallet).toBeNull()
      expect(manager.activeNetwork).toBe('testnet')
    })

    it('returns null and logs warning and error if persisted state is invalid', () => {
      const invalidState = { invalid: 'state' }
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(JSON.stringify(invalidState))

      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      expect(mockLoggerWarn).toHaveBeenCalledWith('Parsed state:', invalidState)
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Could not load state from local storage: Persisted state is invalid'
      )
      expect(manager.store.state).toEqual(DEFAULT_STATE)
    })
  })

  describe('savePersistedState', () => {
    it('saves state to local storage', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
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
  })

  describe('activeWallet', () => {
    beforeEach(() => {
      mockInitialState = {
        wallets: {
          kibisis: {
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
        activeWallet: 'kibisis',
        activeNetwork: 'betanet',
        algodClient: new algosdk.Algodv2('', 'https://betanet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }
    })

    it('returns the active wallet', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.activeWallet?.id).toBe('kibisis')
    })

    it('returns null if no active wallet', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.activeWallet).toBeNull()
    })

    it('returns active wallet accounts', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.activeWalletAccounts?.length).toBe(1)
      expect(manager.activeWalletAddresses).toEqual([
        '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
      ])
    })

    it('removes wallets in state that are not in config', () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })
      expect(manager.wallets.length).toBe(1)
      expect(manager.wallets[0]?.id).toBe('defly')
      expect(manager.activeWallet).toBeNull()
    })
  })

  describe('Transaction Signing', () => {
    it('throws error if no active wallet', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(() => manager.signTransactions).toThrow()
    })
  })

  describe('status', () => {
    it('returns initializing by default', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.status).toBe('initializing')
      expect(manager.isReady).toBe(false)
    })

    it('changes to ready after resumeSessions', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      expect(manager.status).toBe('initializing')
      await manager.resumeSessions()
      expect(manager.status).toBe('ready')
      expect(manager.isReady).toBe(true)
    })
  })

  describe('resumeSessions', () => {
    it('resumes sessions for all wallets', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      expect(manager.status).toBe('initializing')
      await manager.resumeSessions()

      for (const wallet of manager.wallets) {
        expect(wallet.resumeSession).toHaveBeenCalled()
      }
      expect(manager.status).toBe('ready')
    })
  })

  describe('disconnect', () => {
    it('disconnects all connected wallets', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      // Mock isConnected to return true
      for (const wallet of manager.wallets) {
        vi.spyOn(wallet, 'isConnected', 'get').mockReturnValue(true)
      }

      await manager.disconnect()

      for (const wallet of manager.wallets) {
        expect(wallet.disconnect).toHaveBeenCalled()
      }
    })

    it('does not call disconnect on wallets that are not connected', async () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      // Mock isConnected to return false
      for (const wallet of manager.wallets) {
        vi.spyOn(wallet, 'isConnected', 'get').mockReturnValue(false)
      }

      await manager.disconnect()

      for (const wallet of manager.wallets) {
        expect(wallet.disconnect).not.toHaveBeenCalled()
      }
    })
  })

  describe('events', () => {
    it('emits ready event after resumeSessions', async () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const handler = vi.fn()
      manager.on('ready', handler)

      await manager.resumeSessions()

      expect(handler).toHaveBeenCalled()
    })

    it('emits networkChanged event', async () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const handler = vi.fn()
      manager.on('networkChanged', handler)

      await manager.setActiveNetwork('mainnet')

      expect(handler).toHaveBeenCalledWith({ networkId: 'mainnet' })
    })

    it('returns unsubscribe function', async () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const handler = vi.fn()
      const unsubscribe = manager.on('networkChanged', handler)

      await manager.setActiveNetwork('mainnet')
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      await manager.setActiveNetwork('testnet')
      expect(handler).toHaveBeenCalledTimes(1) // Not called again
    })

    it('emits walletConnected when a wallet is added', () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const handler = vi.fn()
      manager.on('walletConnected', handler)

      const account = { name: 'Defly 1', address: 'ADDRESS_1' }
      addWallet(manager.store, {
        walletId: 'defly',
        wallet: { accounts: [account], activeAccount: account }
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ walletId: 'defly', accounts: [account] })
    })

    it('emits walletDisconnected when a wallet is removed', () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const account = { name: 'Defly 1', address: 'ADDRESS_1' }
      addWallet(manager.store, {
        walletId: 'defly',
        wallet: { accounts: [account], activeAccount: account }
      })

      const handler = vi.fn()
      manager.on('walletDisconnected', handler)

      removeWallet(manager.store, { walletId: 'defly' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ walletId: 'defly' })
    })

    it('emits activeWalletChanged when the active wallet changes', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })

      const handler = vi.fn()
      manager.on('activeWalletChanged', handler)

      const account = { name: 'Defly 1', address: 'ADDRESS_1' }
      addWallet(manager.store, {
        walletId: 'defly',
        wallet: { accounts: [account], activeAccount: account }
      })

      expect(handler).toHaveBeenCalledWith({ walletId: 'defly' })

      setActiveWallet(manager.store, { walletId: null })

      expect(handler).toHaveBeenCalledWith({ walletId: null })
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('emits activeAccountChanged when the active account changes', () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const account1 = { name: 'Defly 1', address: 'ADDRESS_1' }
      const account2 = { name: 'Defly 2', address: 'ADDRESS_2' }
      addWallet(manager.store, {
        walletId: 'defly',
        wallet: { accounts: [account1, account2], activeAccount: account1 }
      })

      const handler = vi.fn()
      manager.on('activeAccountChanged', handler)

      setActiveAccount(manager.store, { walletId: 'defly', address: 'ADDRESS_2' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ walletId: 'defly', address: 'ADDRESS_2' })
    })

    it('does not emit activeAccountChanged when a wallet first connects', () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const handler = vi.fn()
      manager.on('activeAccountChanged', handler)

      const account = { name: 'Defly 1', address: 'ADDRESS_1' }
      addWallet(manager.store, {
        walletId: 'defly',
        wallet: { accounts: [account], activeAccount: account }
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('emits error when resumeSessions fails', async () => {
      const manager = new WalletManager({
        wallets: [defly()]
      })

      const error = new Error('Resume failed')
      const wallet = manager.wallets[0]
      ;(wallet.resumeSession as Mock).mockRejectedValueOnce(error)

      const handler = vi.fn()
      manager.on('error', handler)

      await expect(manager.resumeSessions()).rejects.toThrow('Resume failed')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ error })
    })
  })

  describe('availableWallets', () => {
    it('returns all wallets when none have capabilities', () => {
      const manager = new WalletManager({
        wallets: [defly(), kibisis()]
      })
      expect(manager.availableWallets.length).toBe(2)
    })

    it('filters wallets by supportedNetworks on active network', () => {
      const manager = new WalletManager({
        wallets: [deflyWithCapabilities(), kibisis(), exodusAdapter()],
        defaultNetwork: 'testnet'
      })
      // testnet: defly (mainnet+testnet) ✓, kibisis (all) ✓, exodus (mainnet only) ✗
      expect(manager.availableWallets.length).toBe(2)
      expect(manager.availableWallets.map((w) => w.id)).toEqual(['defly', 'kibisis'])
    })

    it('filters wallets by excludedNetworks on active network', async () => {
      const manager = new WalletManager({
        wallets: [mnemonicAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })
      // testnet: mnemonic (excludes mainnet) ✓, kibisis (all) ✓
      expect(manager.availableWallets.length).toBe(2)

      await manager.setActiveNetwork('mainnet')
      // mainnet: mnemonic (excludes mainnet) ✗, kibisis (all) ✓
      expect(manager.availableWallets.length).toBe(1)
      expect(manager.availableWallets[0]?.id).toBe('kibisis')
    })

    it('updates when active network changes', async () => {
      const manager = new WalletManager({
        wallets: [exodusAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })
      // testnet: exodus ✗, kibisis ✓
      expect(manager.availableWallets.length).toBe(1)

      await manager.setActiveNetwork('mainnet')
      // mainnet: exodus ✓, kibisis ✓
      expect(manager.availableWallets.length).toBe(2)
    })

    it('wallets getter still returns all wallets (unchanged)', () => {
      const manager = new WalletManager({
        wallets: [exodusAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })
      // wallets returns all, regardless of network
      expect(manager.wallets.length).toBe(2)
      // availableWallets filters
      expect(manager.availableWallets.length).toBe(1)
    })

    it('resumeSessions runs for all wallets including filtered ones', async () => {
      const manager = new WalletManager({
        wallets: [exodusAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })

      await manager.resumeSessions()

      // All wallets should have resumeSession called, not just available ones
      for (const wallet of manager.wallets) {
        expect(wallet.resumeSession).toHaveBeenCalled()
      }
    })
  })

  describe('disconnectIncompatibleWallets', () => {
    it('disconnects a connected wallet when switching to an unsupported network', async () => {
      // Mnemonic excludes mainnet, start on testnet with mnemonic connected
      mockInitialState = {
        wallets: {
          mnemonic: {
            accounts: [
              {
                name: 'Mnemonic 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Mnemonic 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: 'mnemonic',
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }

      const manager = new WalletManager({
        wallets: [mnemonicAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })

      const mnemonicWallet = manager.getWallet('mnemonic' as any)!
      expect(manager.store.state.wallets).toHaveProperty('mnemonic')

      await manager.setActiveNetwork('mainnet')

      expect(mnemonicWallet.disconnect).toHaveBeenCalled()
    })

    it('clears active wallet when it is disconnected due to network switch', async () => {
      mockInitialState = {
        wallets: {
          mnemonic: {
            accounts: [
              {
                name: 'Mnemonic 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Mnemonic 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: 'mnemonic',
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }

      const manager = new WalletManager({
        wallets: [mnemonicAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })

      // Make mock disconnect remove wallet from store (as the real implementation does)
      const mnemonicWallet = manager.getWallet('mnemonic' as any)!
      vi.mocked(mnemonicWallet.disconnect).mockImplementation(async () => {
        removeWallet(manager.store, { walletId: 'mnemonic' })
        setActiveWallet(manager.store, { walletId: null })
      })

      expect(manager.activeWallet?.id).toBe('mnemonic')

      await manager.setActiveNetwork('mainnet')

      // Active wallet should be cleared (not auto-switched to kibisis)
      expect(manager.activeWallet).toBeNull()
      expect(manager.store.state.activeWallet).toBeNull()
    })

    it('keeps compatible wallets connected after network switch', async () => {
      mockInitialState = {
        wallets: {
          mnemonic: {
            accounts: [
              {
                name: 'Mnemonic 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Mnemonic 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          },
          kibisis: {
            accounts: [
              {
                name: 'Kibisis 1',
                address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
              }
            ],
            activeAccount: {
              name: 'Kibisis 1',
              address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
            }
          }
        },
        activeWallet: 'mnemonic',
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }

      const manager = new WalletManager({
        wallets: [mnemonicAdapter(), kibisis()],
        defaultNetwork: 'testnet'
      })

      const kibisisWallet = manager.getWallet('kibisis' as any)!

      await manager.setActiveNetwork('mainnet')

      // Kibisis has no capabilities, so it should remain connected
      expect(kibisisWallet.disconnect).not.toHaveBeenCalled()
      expect(manager.store.state.wallets).toHaveProperty('kibisis')
    })

    it('keeps wallets with no capabilities connected on any network switch', async () => {
      mockInitialState = {
        wallets: {
          defly: {
            accounts: [
              {
                name: 'Defly 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              }
            ],
            activeAccount: {
              name: 'Defly 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: 'defly',
        activeNetwork: 'testnet',
        algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
        managerStatus: 'ready',
        networkConfig: DEFAULT_NETWORK_CONFIG,
        customNetworkConfigs: {}
      }

      const manager = new WalletManager({
        wallets: [defly(), kibisis()],
        defaultNetwork: 'testnet'
      })

      const deflyWallet = manager.getWallet('defly' as any)!

      await manager.setActiveNetwork('mainnet')

      // Defly has no capabilities, should remain connected
      expect(deflyWallet.disconnect).not.toHaveBeenCalled()
      expect(manager.store.state.wallets).toHaveProperty('defly')
      expect(manager.activeWallet?.id).toBe('defly')
    })
  })

  describe('options', () => {
    describe('persistNetwork', () => {
      it('uses the default network when persistNetwork is false (default), ignoring persisted state', () => {
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
          options: { persistNetwork: false }
        })

        expect(manager.activeNetwork).toBe('testnet')
      })

      it('uses the default network when persistNetwork is unset (defaults to false)', () => {
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
          defaultNetwork: 'testnet'
        })

        expect(manager.activeNetwork).toBe('testnet')
      })

      it('uses the persisted network when persistNetwork is true', () => {
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
          options: { persistNetwork: true }
        })

        expect(manager.activeNetwork).toBe('mainnet')
      })
    })
  })
})
