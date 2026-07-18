import { waitFor } from '@testing-library/svelte'
import {
  BaseWallet,
  NetworkId,
  WalletManager,
  type WalletAccount,
  type StdSignDataResponse,
  type WalletAdapterConfig,
  type AdapterConstructorParams,
  ScopeType,
  type ManagerStatus
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { getContext, setContext } from 'svelte'
import type { Mock } from 'vitest'
import { useWalletContext, useWalletManager, useNetwork, useWallet } from './index'

// Mock Svelte's context functions
vi.mock('svelte', async (importOriginal) => {
  const mod = await importOriginal<typeof import('svelte')>()
  return {
    ...mod,
    getContext: vi.fn(),
    setContext: vi.fn()
  }
})

// Mock the TanStack Svelte store to avoid Svelte context requirements
vi.mock('@tanstack/svelte-store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@tanstack/svelte-store')>()

  // Create a reactive mock that updates when store state changes
  const createReactiveResult = (store: any, selector?: any) => {
    const reactiveResult = {
      get current() {
        if (selector) {
          return selector(store.state)
        }
        return store.state
      }
    }
    return reactiveResult
  }

  return {
    ...mod,
    useStore: vi.fn((store, selector) => createReactiveResult(store, selector))
  }
})

const mocks = vi.hoisted(() => {
  return {
    connect: vi.fn((_args) => Promise.resolve([] as WalletAccount[])),
    disconnect: vi.fn(() => Promise.resolve()),
    setActive: vi.fn(),
    setActiveAccount: vi.fn(),
    resumeSession: vi.fn(() => Promise.resolve()),
    signTransactions: vi.fn(() => Promise.resolve([] as Uint8Array[])),
    transactionSigner: vi.fn(() => Promise.resolve([] as Uint8Array[])),
    signData: vi.fn(() =>
      Promise.resolve({
        signature: new Uint8Array(),
        authenticatorData: new Uint8Array(),
        data: 'test-data',
        signer: new Uint8Array(),
        domain: 'test-domain'
      } as StdSignDataResponse)
    )
  }
})

class MockWalletA extends BaseWallet {
  connect = mocks.connect
  disconnect = mocks.disconnect
  setActive = mocks.setActive
  setActiveAccount = mocks.setActiveAccount
  resumeSession = mocks.resumeSession
  signTransactions = mocks.signTransactions
  transactionSigner = mocks.transactionSigner
  signData = mocks.signData

  static defaultMetadata = { name: 'Wallet A', icon: 'icon-a' }

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

class MockWalletB extends BaseWallet {
  connect = mocks.connect
  disconnect = mocks.disconnect
  setActive = mocks.setActive
  setActiveAccount = mocks.setActiveAccount
  resumeSession = mocks.resumeSession
  signTransactions = mocks.signTransactions
  transactionSigner = mocks.transactionSigner
  signData = mocks.signData

  static defaultMetadata = { name: 'Wallet B', icon: 'icon-b' }

  constructor(params: AdapterConstructorParams) {
    super(params)
  }
}

function mockAdapterA(): WalletAdapterConfig {
  return {
    id: 'wallet-a',
    metadata: MockWalletA.defaultMetadata,
    Adapter: MockWalletA as unknown as WalletAdapterConfig['Adapter']
  }
}

function mockAdapterB(): WalletAdapterConfig {
  return {
    id: 'wallet-b',
    metadata: MockWalletB.defaultMetadata,
    Adapter: MockWalletB as unknown as WalletAdapterConfig['Adapter']
  }
}

function mockAdapterMainnetOnly(): WalletAdapterConfig {
  return {
    id: 'wallet-a',
    metadata: MockWalletA.defaultMetadata,
    Adapter: MockWalletA as unknown as WalletAdapterConfig['Adapter'],
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

let mockWalletManager: WalletManager

const setupMocks = () => {
  localStorage.clear()

  mockWalletManager = new WalletManager({
    wallets: [mockAdapterA(), mockAdapterB()]
  })

  vi.spyOn(mockWalletManager, 'resumeSessions').mockResolvedValue()
}

beforeEach(() => {
  setupMocks()
  vi.clearAllMocks()
})

describe('useWalletContext', () => {
  it('sets the wallet manager in context and resumes sessions', async () => {
    useWalletContext(mockWalletManager)

    expect(setContext).toHaveBeenCalledWith('walletManager', mockWalletManager)

    // Wait for resumeSessions to be called
    await waitFor(() => {
      expect(mockWalletManager.resumeSessions).toHaveBeenCalled()
    })
  })

  it('handles resumeSessions errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Resume session failed')
    mockWalletManager.resumeSessions = vi.fn().mockRejectedValue(error)

    useWalletContext(mockWalletManager)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error resuming sessions:', error)
    })

    consoleSpy.mockRestore()
  })
})

describe('useWalletManager', () => {
  it('returns the wallet manager from context', () => {
    const mockGetContext = getContext as Mock
    mockGetContext.mockReturnValue(mockWalletManager)

    const manager = useWalletManager()

    expect(getContext).toHaveBeenCalledWith('walletManager')
    expect(manager).toBe(mockWalletManager)
  })

  it('throws an error when wallet manager is not in context', () => {
    const mockGetContext = getContext as Mock
    mockGetContext.mockReturnValue(null)

    expect(() => useWalletManager()).toThrow(
      'useWalletManager must be used within a useWalletContext'
    )
  })
})

describe('useNetwork', () => {
  beforeEach(() => {
    const mockGetContext = getContext as Mock
    mockGetContext.mockReturnValue(mockWalletManager)
  })

  it('returns network-related state and functions', () => {
    const network = useNetwork()

    expect(network.activeNetwork).toBeDefined()
    expect(network.networkConfig).toBe(mockWalletManager.networkConfig)
    expect(network.activeNetworkConfig).toBeDefined()
    expect(typeof network.setActiveNetwork).toBe('function')
    expect(typeof network.updateAlgodConfig).toBe('function')
    expect(typeof network.resetNetworkConfig).toBe('function')
  })

  it('sets active network and updates algod client', async () => {
    const network = useNetwork()
    const newNetwork = NetworkId.MAINNET

    const setActiveNetworkSpy = vi.spyOn(mockWalletManager, 'setActiveNetwork').mockResolvedValue()

    await network.setActiveNetwork(newNetwork)

    expect(setActiveNetworkSpy).toHaveBeenCalledWith(newNetwork)
    expect(mockWalletManager.store.state.activeNetwork).toBe(newNetwork)
    expect(mockWalletManager.store.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })

  it('does not change network if already active', async () => {
    const network = useNetwork()
    const currentNetwork = mockWalletManager.store.state.activeNetwork

    const setActiveNetworkSpy = vi.spyOn(mockWalletManager, 'setActiveNetwork').mockResolvedValue()

    await network.setActiveNetwork(currentNetwork)

    expect(setActiveNetworkSpy).not.toHaveBeenCalled()
  })

  it('throws error when setting invalid network', async () => {
    const network = useNetwork()
    const invalidNetwork = 'invalid-network'

    await expect(network.setActiveNetwork(invalidNetwork)).rejects.toThrow(
      `Network "${invalidNetwork}" not found in network configuration`
    )
  })

  it('updates algod config and creates new client for active network', () => {
    const network = useNetwork()
    const networkId = NetworkId.TESTNET
    const config = { baseServer: 'https://new-server.com' }

    const updateAlgodConfigSpy = vi.spyOn(mockWalletManager, 'updateAlgodConfig')

    network.updateAlgodConfig(networkId, config)

    expect(updateAlgodConfigSpy).toHaveBeenCalledWith(networkId, config)
    expect(mockWalletManager.store.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })

  it('does not update algod client when updating config for non-active network', () => {
    const network = useNetwork()
    const nonActiveNetwork = NetworkId.MAINNET
    const config = { baseServer: 'https://new-server.com' }
    const originalClient = mockWalletManager.store.state.algodClient

    const updateAlgodConfigSpy = vi.spyOn(mockWalletManager, 'updateAlgodConfig')

    network.updateAlgodConfig(nonActiveNetwork, config)

    expect(updateAlgodConfigSpy).toHaveBeenCalledWith(nonActiveNetwork, config)
    expect(mockWalletManager.store.state.algodClient).toBe(originalClient)
  })

  it('resets network config and updates client for active network', () => {
    const network = useNetwork()
    const networkId = NetworkId.TESTNET

    const resetNetworkConfigSpy = vi.spyOn(mockWalletManager, 'resetNetworkConfig')

    network.resetNetworkConfig(networkId)

    expect(resetNetworkConfigSpy).toHaveBeenCalledWith(networkId)
    expect(mockWalletManager.store.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })
})

describe('useWallet', () => {
  const testAccount1 = { name: 'Account 1', address: 'address1' }
  const testAccount2 = { name: 'Account 2', address: 'address2' }

  beforeEach(() => {
    const mockGetContext = getContext as Mock
    mockGetContext.mockReturnValue(mockWalletManager)

    // Reset wallets state for each test
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {}
    }))
  })

  it('returns wallet-related state and functions', () => {
    const wallet = useWallet()

    expect(Array.isArray(wallet.wallets)).toBe(true)
    expect(typeof wallet.isReady).toBe('function')
    expect(wallet.algodClient).toBeDefined()
    expect(typeof wallet.activeWallet).toBe('function')
    expect(wallet.activeWalletAccounts).toBeDefined()
    expect(wallet.activeWalletAddresses).toBeDefined()
    expect(wallet.activeAccount).toBeDefined()
    expect(wallet.activeAddress).toBeDefined()
    expect(typeof wallet.signData).toBe('function')
    expect(typeof wallet.signTransactions).toBe('function')
    expect(typeof wallet.transactionSigner).toBe('function')
  })

  it('transforms base wallets to wallet interface correctly', () => {
    const wallet = useWallet()

    expect(wallet.wallets).toHaveLength(2)

    const walletA = wallet.wallets.find((w) => w.id === 'wallet-a')
    expect(walletA).toBeDefined()
    expect(walletA!.metadata.name).toBe('Wallet A')
    expect(typeof walletA!.connect).toBe('function')
    expect(typeof walletA!.disconnect).toBe('function')
    expect(typeof walletA!.setActive).toBe('function')
    expect(typeof walletA!.setActiveAccount).toBe('function')
    expect(typeof walletA!.isConnected).toBe('function')
    expect(typeof walletA!.isActive).toBe('function')

    const walletB = wallet.wallets.find((w) => w.id === 'wallet-b')
    expect(walletB).toBeDefined()
    expect(walletB!.metadata.name).toBe('Wallet B')
  })

  it('correctly identifies wallet connection status', () => {
    const wallet = useWallet()
    const walletA = wallet.wallets.find((w) => w.id === 'wallet-a')!

    // Initially not connected
    expect(walletA.isConnected()).toBe(false)

    // Simulate connection
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      }
    }))

    expect(walletA.isConnected()).toBe(true)
  })

  it('correctly identifies active wallet', () => {
    const wallet = useWallet()
    const walletA = wallet.wallets.find((w) => w.id === 'wallet-a')!

    // Initially no active wallet
    expect(walletA.isActive()).toBe(false)

    // Set active wallet
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-a'
    }))

    expect(walletA.isActive()).toBe(true)
  })

  it('calls wallet methods correctly', async () => {
    const wallet = useWallet()
    const walletA = wallet.wallets.find((w) => w.id === 'wallet-a')!

    await walletA.connect()
    expect(mocks.connect).toHaveBeenCalledWith(undefined)

    await walletA.disconnect()
    expect(mocks.disconnect).toHaveBeenCalled()

    walletA.setActive()
    expect(mocks.setActive).toHaveBeenCalled()

    walletA.setActiveAccount('test-address')
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('test-address')
  })

  it('returns isReady status based on manager status', () => {
    // Set manager to ready first
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    const wallet = useWallet()

    expect(wallet.isReady()).toBe(true)

    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'loading' as ManagerStatus
    }))

    expect(wallet.isReady()).toBe(false)
  })

  it('provides active wallet information', () => {
    const wallet = useWallet()

    // Initially no active wallet
    expect(wallet.activeWallet()).toBeUndefined()

    // Set active wallet with accounts
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-a',
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      }
    }))

    const activeWallet = wallet.activeWallet()
    expect(activeWallet).toBeDefined()
    expect(activeWallet!.id).toBe('wallet-a')

    expect(wallet.activeWalletAccounts.current).toEqual([testAccount1, testAccount2])
    expect(wallet.activeWalletAddresses.current).toEqual(['address1', 'address2'])
    expect(wallet.activeAccount.current).toBe(testAccount1)
    expect(wallet.activeAddress.current).toBe('address1')
  })

  it('throws error when signing transactions without active wallet', () => {
    const wallet = useWallet()

    expect(() => wallet.signTransactions([])).toThrow('No active wallet')
  })

  it('signs transactions with active wallet', async () => {
    const wallet = useWallet()

    // Set active wallet
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-a'
    }))

    const txns = [] as algosdk.Transaction[]
    const indexes = [0]

    await wallet.signTransactions(txns, indexes)

    expect(mocks.signTransactions).toHaveBeenCalledWith(txns, indexes)
  })

  it('throws error when using transaction signer without active wallet', () => {
    const wallet = useWallet()

    expect(() => wallet.transactionSigner([], [])).toThrow('No active wallet')
  })

  it('uses transaction signer with active wallet', async () => {
    const wallet = useWallet()

    // Set active wallet
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-a'
    }))

    const txns = [] as algosdk.Transaction[]
    const indexes = [0]

    await wallet.transactionSigner(txns, indexes)

    expect(mocks.transactionSigner).toHaveBeenCalledWith(txns, indexes)
  })

  it('throws error when signing data without active wallet', () => {
    const wallet = useWallet()

    expect(() => wallet.signData('data', { scope: ScopeType.AUTH, encoding: 'utf8' })).toThrow(
      'No active wallet'
    )
  })

  it('signs data with active wallet', async () => {
    const wallet = useWallet()

    // Set active wallet
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-a'
    }))

    const data = 'test-data'
    const metadata = { scope: ScopeType.AUTH, encoding: 'utf8' as const }

    await wallet.signData(data, metadata)

    expect(mocks.signData).toHaveBeenCalledWith(data, metadata)
  })
})

describe('useWallet - availableWallets', () => {
  it('filters wallets by active network capabilities', () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    vi.spyOn(manager, 'resumeSessions').mockResolvedValue()
    ;(getContext as Mock).mockReturnValue(manager)

    const wallet = useWallet()

    // testnet: wallet-a (mainnet only) ✗, wallet-b (all) ✓
    expect(wallet.wallets).toHaveLength(2)
    expect(wallet.availableWallets.current).toHaveLength(1)
    expect(wallet.availableWallets.current[0].id).toBe('wallet-b')
  })

  it('re-filters when active network changes', async () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    vi.spyOn(manager, 'resumeSessions').mockResolvedValue()
    ;(getContext as Mock).mockReturnValue(manager)

    const wallet = useWallet()

    expect(wallet.availableWallets.current).toHaveLength(1)

    await manager.setActiveNetwork('mainnet')

    // mainnet: wallet-a ✓, wallet-b ✓
    expect(wallet.availableWallets.current).toHaveLength(2)
  })

  it('returns all wallets when none have capabilities', () => {
    ;(getContext as Mock).mockReturnValue(mockWalletManager)

    const wallet = useWallet()

    expect(wallet.availableWallets.current).toHaveLength(2)
    expect(wallet.wallets).toHaveLength(2)
  })
})
