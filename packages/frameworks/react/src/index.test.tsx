import { renderHook, act, render, screen } from '@testing-library/react'
import {
  BaseWallet,
  NetworkId,
  WalletManager,
  type WalletAccount,
  type WalletAdapterConfig,
  type AdapterConstructorParams
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import * as React from 'react'
import { WalletProvider, useWallet, useNetwork } from './index'
import type { ResolvedWalletAccount, ResolvedWalletManager } from './index'

const mocks = vi.hoisted(() => {
  return {
    connect: vi.fn((_args) => Promise.resolve([] as WalletAccount[])),
    disconnect: vi.fn(() => Promise.resolve()),
    setActive: vi.fn(),
    setActiveAccount: vi.fn(),
    resumeSession: vi.fn(() => Promise.resolve()),
    signTransactions: vi.fn(() => Promise.resolve([] as Uint8Array[])),
    transactionSigner: vi.fn(() => Promise.resolve([] as Uint8Array[]))
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

describe('WalletProvider', () => {
  it('provides context to child components', async () => {
    const TestComponent = () => {
      const { wallets } = useWallet()
      return <h1>{wallets ? 'Context provided' : 'No context'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [mockAdapterA()]
    })

    await act(async () => {
      render(
        <WalletProvider manager={walletManager}>
          <TestComponent />
        </WalletProvider>
      )
    })

    expect(screen.getByText('Context provided')).toBeInTheDocument()
  })

  it('resumes sessions on mount', () => {
    const mockResumeSessions = vi.fn()
    const fakeManager = { resumeSessions: mockResumeSessions }

    render(
      <WalletProvider manager={fakeManager as unknown as WalletManager}>
        <div />
      </WalletProvider>
    )

    expect(mockResumeSessions).toHaveBeenCalled()
  })
})

describe('useNetwork', () => {
  let mockWalletManager: WalletManager
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    vi.clearAllMocks()
    mockWalletManager = new WalletManager({
      wallets: [mockAdapterA(), mockAdapterB()]
    })

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={mockWalletManager}>{children}</WalletProvider>
    )
  })

  it('throws an error when used outside of WalletProvider', () => {
    const TestComponent = () => {
      try {
        useNetwork()
        return <div>No error thrown</div>
      } catch (error: any) {
        return <div>{error.message}</div>
      }
    }

    render(<TestComponent />)
    expect(
      screen.getByText('useNetwork must be used within the WalletProvider')
    ).toBeInTheDocument()
  })

  it('provides network-related functionality', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper })

    expect(result.current.activeNetwork).toBe(NetworkId.TESTNET)
    expect(result.current.networkConfig).toBeDefined()
    expect(result.current.activeNetworkConfig).toBe(
      mockWalletManager.networkConfig[NetworkId.TESTNET]
    )
    expect(typeof result.current.setActiveNetwork).toBe('function')
    expect(typeof result.current.updateAlgodConfig).toBe('function')
  })

  it('updates activeNetwork and algodClient when setActiveNetwork is called', async () => {
    const newNetwork = NetworkId.MAINNET

    const { result } = renderHook(() => useNetwork(), { wrapper })

    await act(async () => {
      await result.current.setActiveNetwork(newNetwork)
    })

    expect(mockWalletManager.store.state.activeNetwork).toBe(newNetwork)
  })

  it('calls updateAlgodConfig on the manager when updating network config', () => {
    const { result } = renderHook(() => useNetwork(), { wrapper })
    const networkId = NetworkId.TESTNET
    const config = { baseServer: 'https://new-server.com' }

    act(() => {
      result.current.updateAlgodConfig(networkId, config)
    })

    expect(mockWalletManager.networkConfig[networkId].algod.baseServer).toBe(config.baseServer)
  })

  it('throws error when setting invalid network', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper })
    const invalidNetwork = 'invalid-network'

    await expect(result.current.setActiveNetwork(invalidNetwork)).rejects.toThrow(
      `Network "${invalidNetwork}" not found in network configuration`
    )
  })

  it('provides resetNetworkConfig functionality', () => {
    const resetNetworkConfigSpy = vi.spyOn(mockWalletManager, 'resetNetworkConfig')
    const { result } = renderHook(() => useNetwork(), { wrapper })

    expect(typeof result.current.resetNetworkConfig).toBe('function')

    act(() => {
      result.current.resetNetworkConfig(NetworkId.TESTNET)
    })

    expect(resetNetworkConfigSpy).toHaveBeenCalledWith(NetworkId.TESTNET)
  })
})

describe('useWallet', () => {
  let mockWalletManager: WalletManager
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    vi.clearAllMocks()

    mockWalletManager = new WalletManager({
      wallets: [mockAdapterA(), mockAdapterB()]
    })

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={mockWalletManager}>{children}</WalletProvider>
    )
  })

  it('throws an error when used outside of WalletProvider', () => {
    const TestComponent = () => {
      try {
        useWallet()
        return <div>No error thrown</div>
      } catch (error: any) {
        return <div>{error.message}</div>
      }
    }

    render(<TestComponent />)
    expect(screen.getByText('useWallet must be used within the WalletProvider')).toBeInTheDocument()
  })

  it('initializes wallets and active wallet correctly', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.wallets).toHaveLength(2)
    expect(result.current.wallets[0].id).toBe('wallet-a')
    expect(result.current.wallets[1].id).toBe('wallet-b')
    expect(result.current.activeWallet).toBeNull()
    expect(result.current.activeAccount).toBeNull()
  })

  it('correctly handles wallet connect/disconnect', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    const walletA = result.current.wallets[0]

    await act(async () => {
      await walletA.connect()
      await walletA.disconnect()
    })

    expect(mocks.connect).toHaveBeenCalledWith(undefined)
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls setActive and setActiveAccount correctly', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      const walletA = result.current.wallets.find((w) => w.id === 'wallet-a')
      if (!walletA) throw new Error('Wallet A not found')
      walletA.setActive()
    })

    expect(mocks.setActive).toHaveBeenCalled()

    await act(async () => {
      const walletA = result.current.wallets.find((w) => w.id === 'wallet-a')
      if (!walletA) throw new Error('Wallet A not found')
      walletA.setActiveAccount('test-address')
    })

    expect(mocks.setActiveAccount).toHaveBeenCalledWith('test-address')
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    act(() => {
      mockWalletManager.store.setState((state) => ({
        ...state,
        wallets: {
          'wallet-a': {
            accounts: [{ name: 'Account 1', address: 'address1' }],
            activeAccount: { name: 'Account 1', address: 'address1' }
          }
        },
        activeWallet: 'wallet-a'
      }))
    })

    await act(async () => {
      await result.current.signTransactions([], [])
      await result.current.transactionSigner([], [])
    })

    expect(mocks.signTransactions).toHaveBeenCalledWith([], [])
    expect(mocks.transactionSigner).toHaveBeenCalledWith([], [])
  })

  it('updates wallets when store state changes', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      mockWalletManager.store.setState((state) => ({
        ...state,
        wallets: {
          'wallet-a': {
            accounts: [{ name: 'Account 1', address: 'address1' }],
            activeAccount: { name: 'Account 1', address: 'address1' }
          }
        },
        activeWallet: 'wallet-a'
      }))
    })

    expect(result.current.activeWallet?.id).toBe('wallet-a')
    expect(result.current.activeAddress).toBe('address1')
  })

  it('updates isReady when manager status changes', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    expect(result.current.isReady).toBe(false)

    await act(async () => {
      mockWalletManager.store.setState((state) => ({
        ...state,
        managerStatus: 'ready'
      }))
    })

    expect(result.current.isReady).toBe(true)
  })

  it('updates algodClient when setAlgodClient is called', async () => {
    const newAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      result.current.setAlgodClient(newAlgodClient)
    })

    expect(result.current.algodClient).toBe(newAlgodClient)
  })
})

describe('useWallet - availableWallets', () => {
  it('filters wallets by active network capabilities', async () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={manager}>{children}</WalletProvider>
    )

    const { result } = renderHook(() => useWallet(), { wrapper })

    // testnet: wallet-a (mainnet only) ✗, wallet-b (all) ✓
    expect(result.current.wallets).toHaveLength(2)
    expect(result.current.availableWallets).toHaveLength(1)
    expect(result.current.availableWallets[0].id).toBe('wallet-b')
  })

  it('re-filters when active network changes', async () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={manager}>{children}</WalletProvider>
    )

    const { result } = renderHook(() => useWallet(), { wrapper })

    expect(result.current.availableWallets).toHaveLength(1)

    await act(async () => {
      await manager.setActiveNetwork('mainnet')
    })

    // mainnet: wallet-a ✓, wallet-b ✓
    expect(result.current.availableWallets).toHaveLength(2)
  })

  it('returns all wallets when none have capabilities', () => {
    const manager = new WalletManager({
      wallets: [mockAdapterA(), mockAdapterB()]
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={manager}>{children}</WalletProvider>
    )

    const { result } = renderHook(() => useWallet(), { wrapper })

    expect(result.current.availableWallets).toHaveLength(2)
    expect(result.current.wallets).toHaveLength(2)
  })
})

describe('Register - account type resolution', () => {
  // Type-level equality assertion: `Eq<A, B>` resolves to the literal type
  // `true` only when A and B are identical, so `const x: Eq<A, B> = true`
  // fails to compile if the inference ever regresses.
  type Eq<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false

  interface QuantumAccount extends WalletAccount {
    kind: 'quantum'
    handleQuantumOperation: () => string
  }

  interface ClassicAccount extends WalletAccount {
    kind: 'classic'
    legacyId: number
  }

  it('defaults to the base WalletAccount without a Register declaration', () => {
    const manager = new WalletManager({
      wallets: [mockAdapterA()]
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={manager}>{children}</WalletProvider>
    )

    const { result } = renderHook(() => useWallet(), { wrapper })

    const activeAccount: Eq<typeof result.current.activeAccount, WalletAccount | null> = true
    const accounts: Eq<(typeof result.current.wallets)[number]['accounts'], WalletAccount[]> = true

    expect(activeAccount && accounts).toBe(true)
    expect(result.current.wallets).toHaveLength(1)
  })

  it('resolves the account union from a registered manager type', () => {
    // Classic construction with an explicitly declared union;
    // `WalletManager.create({ wallets: [...] })` infers the same shape
    // from the adapter configs (covered by the core test suite)
    const manager = new WalletManager<QuantumAccount | ClassicAccount>({
      wallets: [mockAdapterA()]
    })

    // The resolution chain the public hook uses: a `Register` declaration
    // carrying `typeof manager` resolves to the manager type and its
    // account union (apps write `declare module '@txnlab/use-wallet-react'
    // { interface Register { manager: typeof manager } }`)
    const resolvedManager: Eq<
      ResolvedWalletManager<{ manager: typeof manager }>,
      WalletManager<QuantumAccount | ClassicAccount>
    > = true
    const resolvedAccount: Eq<
      ResolvedWalletAccount<{ manager: typeof manager }>,
      QuantumAccount | ClassicAccount
    > = true

    // Without a registration, resolution falls back to the base types
    const unregisteredManager: Eq<ResolvedWalletManager, WalletManager> = true
    const unregisteredAccount: Eq<ResolvedWalletAccount, WalletAccount> = true

    expect(manager).toBeInstanceOf(WalletManager)
    expect(resolvedManager && resolvedAccount).toBe(true)
    expect(unregisteredManager && unregisteredAccount).toBe(true)
  })
})
