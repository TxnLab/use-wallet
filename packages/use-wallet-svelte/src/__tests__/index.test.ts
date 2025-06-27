import { waitFor } from '@testing-library/svelte'
import { Store } from '@tanstack/svelte-store'
import {
  BaseWallet,
  DeflyWallet,
  LuteWallet,
  NetworkId,
  WalletManager,
  WalletId,
  DEFAULT_NETWORK_CONFIG,
  type State,
  type WalletAccount,
  type SignDataResponse,
  ScopeType,
  ManagerStatus
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { getContext, setContext } from 'svelte'
import type { Mock } from 'vitest'
import { useWalletContext, useWalletManager, useNetwork, useWallet } from '../index'

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
      } as SignDataResponse)
    )
  }
})

vi.mock('@txnlab/use-wallet', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@txnlab/use-wallet')>()
  return {
    ...mod,
    LuteWallet: class extends mod.BaseWallet {
      connect = mocks.connect
      disconnect = mocks.disconnect
      setActive = mocks.setActive
      setActiveAccount = mocks.setActiveAccount
      resumeSession = mocks.resumeSession
      signTransactions = mocks.signTransactions
      transactionSigner = mocks.transactionSigner
      signData = mocks.signData
    },
    DeflyWallet: class extends mod.BaseWallet {
      connect = mocks.connect
      disconnect = mocks.disconnect
      setActive = mocks.setActive
      setActiveAccount = mocks.setActiveAccount
      resumeSession = mocks.resumeSession
      signTransactions = mocks.signTransactions
      transactionSigner = mocks.transactionSigner
      signData = mocks.signData
    }
  }
})

let mockStore: Store<State>
let mockWalletManager: WalletManager
let mockDeflyWallet: DeflyWallet
let mockLuteWallet: LuteWallet

const setupMocks = () => {
  mockStore = new Store<State>({
    activeNetwork: NetworkId.TESTNET,
    activeWallet: null,
    algodClient: new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''),
    managerStatus: 'ready',
    wallets: {},
    customNetworkConfigs: {},
    networkConfig: DEFAULT_NETWORK_CONFIG
  })

  mockWalletManager = new WalletManager({
    wallets: [
      {
        id: WalletId.LUTE,
        options: {
          siteName: 'Test Site'
        }
      },
      WalletId.DEFLY
    ]
  })

  vi.spyOn(mockWalletManager, 'store', 'get').mockReturnValue(mockStore)
  vi.spyOn(mockWalletManager, 'resumeSessions').mockResolvedValue()

  mockLuteWallet = new LuteWallet({
    id: WalletId.LUTE,
    options: {
      siteName: 'Test Site'
    },
    metadata: { name: 'Lute', icon: 'icon' },
    getAlgodClient: () => ({}) as any,
    store: mockStore,
    subscribe: vi.fn()
  })

  mockDeflyWallet = new DeflyWallet({
    id: WalletId.DEFLY,
    metadata: { name: 'Defly', icon: 'icon' },
    getAlgodClient: () => ({}) as any,
    store: mockStore,
    subscribe: vi.fn()
  })

  mockWalletManager._clients = new Map<WalletId, BaseWallet>([
    [WalletId.LUTE, mockLuteWallet],
    [WalletId.DEFLY, mockDeflyWallet]
  ])
}

beforeEach(() => {
  setupMocks()
  vi.clearAllMocks()
  mockStore.setState((state) => ({
    ...state,
    activeNetwork: NetworkId.TESTNET,
    activeWallet: null,
    algodClient: new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''),
    managerStatus: 'ready',
    wallets: {},
    networkConfig: { ...DEFAULT_NETWORK_CONFIG },
    customNetworkConfigs: {}
  }))
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
    expect(mockStore.state.activeNetwork).toBe(newNetwork)
    expect(mockStore.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })

  it('does not change network if already active', async () => {
    const network = useNetwork()
    const currentNetwork = mockStore.state.activeNetwork

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
    expect(mockStore.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })

  it('does not update algod client when updating config for non-active network', () => {
    const network = useNetwork()
    const nonActiveNetwork = NetworkId.MAINNET
    const config = { baseServer: 'https://new-server.com' }
    const originalClient = mockStore.state.algodClient

    const updateAlgodConfigSpy = vi.spyOn(mockWalletManager, 'updateAlgodConfig')

    network.updateAlgodConfig(nonActiveNetwork, config)

    expect(updateAlgodConfigSpy).toHaveBeenCalledWith(nonActiveNetwork, config)
    expect(mockStore.state.algodClient).toBe(originalClient)
  })

  it('resets network config and updates client for active network', () => {
    const network = useNetwork()
    const networkId = NetworkId.TESTNET

    const resetNetworkConfigSpy = vi.spyOn(mockWalletManager, 'resetNetworkConfig')

    network.resetNetworkConfig(networkId)

    expect(resetNetworkConfigSpy).toHaveBeenCalledWith(networkId)
    expect(mockStore.state.algodClient).toBeInstanceOf(algosdk.Algodv2)
  })
})

describe('useWallet', () => {
  const testAccount1 = { name: 'Account 1', address: 'address1' }
  const testAccount2 = { name: 'Account 2', address: 'address2' }

  beforeEach(() => {
    const mockGetContext = getContext as Mock
    mockGetContext.mockReturnValue(mockWalletManager)

    // Reset wallets state for each test
    mockStore.setState((state) => ({
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

    const luteWallet = wallet.wallets.find((w) => w.id === WalletId.LUTE)
    expect(luteWallet).toBeDefined()
    expect(luteWallet!.metadata.name).toBe('Lute')
    expect(typeof luteWallet!.connect).toBe('function')
    expect(typeof luteWallet!.disconnect).toBe('function')
    expect(typeof luteWallet!.setActive).toBe('function')
    expect(typeof luteWallet!.setActiveAccount).toBe('function')
    expect(typeof luteWallet!.isConnected).toBe('function')
    expect(typeof luteWallet!.isActive).toBe('function')

    const deflyWallet = wallet.wallets.find((w) => w.id === WalletId.DEFLY)
    expect(deflyWallet).toBeDefined()
    expect(deflyWallet!.metadata.name).toBe('Defly')
  })

  it('correctly identifies wallet connection status', () => {
    const wallet = useWallet()
    const luteWallet = wallet.wallets.find((w) => w.id === WalletId.LUTE)!

    // Initially not connected
    expect(luteWallet.isConnected()).toBe(false)

    // Simulate connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.LUTE]: {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      }
    }))

    expect(luteWallet.isConnected()).toBe(true)
  })

  it('correctly identifies active wallet', () => {
    const wallet = useWallet()
    const luteWallet = wallet.wallets.find((w) => w.id === WalletId.LUTE)!

    // Initially no active wallet
    expect(luteWallet.isActive()).toBe(false)

    // Set active wallet
    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.LUTE
    }))

    expect(luteWallet.isActive()).toBe(true)
  })

  it('calls wallet methods correctly', async () => {
    const wallet = useWallet()
    const luteWallet = wallet.wallets.find((w) => w.id === WalletId.LUTE)!

    await luteWallet.connect()
    expect(mocks.connect).toHaveBeenCalledWith(undefined)

    await luteWallet.disconnect()
    expect(mocks.disconnect).toHaveBeenCalled()

    luteWallet.setActive()
    expect(mocks.setActive).toHaveBeenCalled()

    luteWallet.setActiveAccount('test-address')
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('test-address')
  })

  it('returns isReady status based on manager status', () => {
    const wallet = useWallet()

    expect(wallet.isReady()).toBe(true)

    mockStore.setState((state) => ({
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
    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.LUTE,
      wallets: {
        ...state.wallets,
        [WalletId.LUTE]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      }
    }))

    const activeWallet = wallet.activeWallet()
    expect(activeWallet).toBeDefined()
    expect(activeWallet!.id).toBe(WalletId.LUTE)

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
    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.LUTE
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
    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.LUTE
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
    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.LUTE
    }))

    const data = 'test-data'
    const metadata = { scope: ScopeType.AUTH, encoding: 'utf8' as const }

    await wallet.signData(data, metadata)

    expect(mocks.signData).toHaveBeenCalledWith(data, metadata)
  })
})
