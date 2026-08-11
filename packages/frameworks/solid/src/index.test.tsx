import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import {
  BaseWallet,
  NetworkId,
  WalletManager,
  type WalletAccount,
  type WalletAdapterConfig,
  type AdapterConstructorParams,
  type ManagerStatus
} from '@txnlab/use-wallet'
import { For } from 'solid-js'
import { WalletProvider, useWallet, useWalletManager, useNetwork } from './index'

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

const testAccount1 = { name: 'Account 1', address: 'address1' }
const testAccount2 = { name: 'Account 2', address: 'address2' }

describe('WalletProvider', () => {
  it('provides the WalletManager to its children', () => {
    const TestComponent = () => {
      const manager = useWalletManager()
      return <h1>{manager ? 'Manager provided' : 'No manager'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [mockAdapterA()]
    })

    render(() => (
      <WalletProvider manager={walletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByText('Manager provided')).toBeInTheDocument()
  })

  it('throws an error when useWalletManager is used outside of WalletProvider', () => {
    const TestComponent = () => {
      try {
        useWalletManager()
        return <div>No error thrown</div>
      } catch (error: any) {
        return <div>{error.message}</div>
      }
    }

    render(() => <TestComponent />)
    expect(
      screen.getByText('useWalletManager must be used within a WalletProvider')
    ).toBeInTheDocument()
  })

  it('calls resumeSessions on mount', async () => {
    const mockResumeSessions = vi.fn()
    const fakeManager = { resumeSessions: mockResumeSessions }

    render(() => (
      <WalletProvider manager={fakeManager as any as WalletManager}>
        <div />
      </WalletProvider>
    ))

    expect(mockResumeSessions).toHaveBeenCalled()
  })
})

describe('useNetwork', () => {
  let mockWalletManager: WalletManager

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockWalletManager = new WalletManager({
      wallets: [mockAdapterA(), mockAdapterB()]
    })

    vi.spyOn(mockWalletManager, 'resumeSessions').mockResolvedValue()
  })

  it('throws error for invalid network', async () => {
    let error: Error | undefined

    const TestComponent = () => {
      const { setActiveNetwork } = useNetwork()
      return (
        <button
          onClick={async () => {
            try {
              await setActiveNetwork('invalid-network')
            } catch (e) {
              error = e as Error
            }
          }}
        >
          Test
        </button>
      )
    }

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    const button = screen.getByText('Test')
    fireEvent.click(button)

    await waitFor(() => {
      expect(error?.message).toBe('Network "invalid-network" not found in network configuration')
    })
  })

  it('provides activeNetworkConfig through useNetwork', () => {
    const TestComponent = () => {
      const { activeNetworkConfig } = useNetwork()
      return <div data-testid="active-network-config">{JSON.stringify(activeNetworkConfig())}</div>
    }

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('active-network-config')).toHaveTextContent(
      JSON.stringify(mockWalletManager.networkConfig[NetworkId.TESTNET])
    )
  })

  it('provides updateAlgodConfig function', () => {
    const TestComponent = () => {
      const { updateAlgodConfig } = useNetwork()
      return <div data-testid="update-network-algod-type">{typeof updateAlgodConfig}</div>
    }

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('update-network-algod-type')).toHaveTextContent('function')
  })

  it('calls updateAlgodConfig on the manager when updating network config', () => {
    const networkId = NetworkId.TESTNET
    const config = {
      token: 'new-token',
      baseServer: 'https://new-server.com',
      port: '443'
    }

    const TestComponent = () => {
      const { updateAlgodConfig } = useNetwork()
      return (
        <button data-testid="update-btn" onClick={() => updateAlgodConfig(networkId, config)}>
          Update
        </button>
      )
    }

    const mockUpdateAlgodConfig = vi.fn()
    mockWalletManager.updateAlgodConfig = mockUpdateAlgodConfig

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    const updateButton = screen.getByTestId('update-btn')
    fireEvent.click(updateButton)

    expect(mockUpdateAlgodConfig).toHaveBeenCalledWith(networkId, config)
  })

  it('provides resetNetworkConfig functionality', () => {
    const mockResetNetworkConfig = vi.fn()
    mockWalletManager.resetNetworkConfig = mockResetNetworkConfig

    const TestComponent = () => {
      const { resetNetworkConfig } = useNetwork()
      return (
        <button data-testid="reset-btn" onClick={() => resetNetworkConfig(NetworkId.TESTNET)}>
          Reset Network
        </button>
      )
    }

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    const resetButton = screen.getByTestId('reset-btn')
    fireEvent.click(resetButton)

    expect(mockResetNetworkConfig).toHaveBeenCalledWith(NetworkId.TESTNET)
  })
})

describe('useWallet', () => {
  let mockWalletManager: WalletManager

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockWalletManager = new WalletManager({
      wallets: [mockAdapterA(), mockAdapterB()]
    })

    // Start with initializing status for isReady tests
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'initializing' as ManagerStatus
    }))
  })

  const TestComponent = () => {
    const {
      activeAccount,
      activeAddress,
      activeWallet,
      activeWalletAccounts,
      activeWalletAddresses,
      wallets,
      isReady,
      algodClient
    } = useWallet()

    const { activeNetwork, setActiveNetwork } = useNetwork()

    return (
      <div>
        <div data-testid="is-ready">{JSON.stringify(isReady())}</div>
        <div data-testid="active-account">{JSON.stringify(activeAccount())}</div>
        <div data-testid="active-address">{JSON.stringify(activeAddress())}</div>
        <div data-testid="active-network">{activeNetwork()}</div>
        <div data-testid="active-wallet">{JSON.stringify(activeWallet()?.id || 'null')}</div>
        <div data-testid="active-wallet-accounts">{JSON.stringify(activeWalletAccounts())}</div>
        <div data-testid="active-wallet-addresses">
          {activeWalletAddresses()?.join(', ') || 'null'}
        </div>
        <div data-testid="wallets">
          {wallets()
            .map((wallet) => wallet.id)
            .join(', ')}
        </div>
        <div data-testid="algod-client">{JSON.stringify(algodClient())}</div>

        <For each={wallets()}>
          {(wallet) => (
            <div data-testid="wallet">
              <h4 data-testid={`wallet-name-${wallet.id}`}>{wallet.metadata.name}</h4>
              <p data-testid={`wallet-status-${wallet.id}`}>
                {wallet.isActive ? 'Active' : wallet.isConnected ? 'Connected' : 'Disconnected'}
              </p>
              <button
                data-testid={`connect-btn-${wallet.id}`}
                onClick={() => wallet.connect()}
                disabled={wallet.isConnected}
              >
                Connect
              </button>
              <button
                data-testid={`disconnect-btn-${wallet.id}`}
                onClick={() => wallet.disconnect()}
                disabled={!wallet.isConnected}
              >
                Disconnect
              </button>
              <button
                data-testid={`set-active-btn-${wallet.id}`}
                onClick={() => wallet.setActive()}
                disabled={wallet.isActive}
              >
                Set Active
              </button>
              <button
                data-testid={`set-active-account-btn-${wallet.id}`}
                onClick={() => wallet.setActiveAccount(wallet.accounts[0]?.address)}
                disabled={!wallet.isActive || !wallet.isConnected}
              >
                Set Active Account
              </button>
            </div>
          )}
        </For>

        <button
          data-testid="set-active-network-btn"
          onClick={() => setActiveNetwork(NetworkId.MAINNET)}
        >
          Set Active Network to Mainnet
        </button>
      </div>
    )
  }

  it('initializes wallets and active wallet correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))
    expect(screen.getByTestId('wallets')).toHaveTextContent('wallet-a, wallet-b')
    expect(screen.getAllByTestId('wallet')).toHaveLength(2)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent('null')
    expect(screen.getByTestId('active-account')).toHaveTextContent('null')
    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.TESTNET)
  })

  it('calls connect and disconnect correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    // Trigger connect for wallet-a
    const connectButton = screen.getByTestId('connect-btn-wallet-a')
    fireEvent.click(connectButton)
    expect(mocks.connect).toHaveBeenCalled()

    // Simulate wallet-a connection
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: 'wallet-a'
    }))

    // Trigger disconnect
    const disconnectButton = screen.getByTestId('disconnect-btn-wallet-a')
    fireEvent.click(disconnectButton)
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls setActive and setActiveAccount correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        },
        'wallet-b': {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      },
      activeWallet: 'wallet-a'
    }))

    const setActiveButton = screen.getByTestId('set-active-btn-wallet-b')
    fireEvent.click(setActiveButton)
    expect(mocks.setActive).toHaveBeenCalled()

    mockWalletManager.store.setState((state) => ({
      ...state,
      activeWallet: 'wallet-b'
    }))

    const setActiveAccountButton = screen.getByTestId('set-active-account-btn-wallet-b')
    fireEvent.click(setActiveAccountButton)
    expect(mocks.setActiveAccount).toHaveBeenCalledWith(testAccount1.address)
  })

  it('updates wallets when store state changes', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('active-account')).toHaveTextContent('null')
    expect(screen.getByTestId('active-address')).toHaveTextContent('null')
    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.TESTNET)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent('null')
    expect(screen.getByTestId('active-wallet-accounts')).toHaveTextContent('null')
    expect(screen.getByTestId('active-wallet-addresses')).toHaveTextContent('null')
    expect(screen.getByTestId('wallets')).toHaveTextContent('wallet-a, wallet-b')
    expect(screen.getAllByTestId('wallet')).toHaveLength(2)
    expect(screen.getByTestId('wallet-name-wallet-a')).toHaveTextContent('Wallet A')
    expect(screen.getByTestId('wallet-status-wallet-a')).toHaveTextContent('Disconnected')
    expect(screen.getByTestId('wallet-name-wallet-b')).toHaveTextContent('Wallet B')
    expect(screen.getByTestId('wallet-status-wallet-b')).toHaveTextContent('Disconnected')

    // Simulate wallet-a connection
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: 'wallet-a'
    }))

    expect(screen.getByTestId('active-account')).toHaveTextContent(JSON.stringify(testAccount2))
    expect(screen.getByTestId('active-address')).toHaveTextContent(testAccount2.address)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent('wallet-a')
    expect(screen.getByTestId('active-wallet-accounts')).toHaveTextContent(
      JSON.stringify([testAccount1, testAccount2])
    )
    expect(screen.getByTestId('active-wallet-addresses')).toHaveTextContent('address1, address2')
    expect(screen.getByTestId('wallet-status-wallet-a')).toHaveTextContent('Active')
    expect(screen.getByTestId('wallet-status-wallet-b')).toHaveTextContent('Disconnected')

    // Simulate wallet-b connection and set active
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-b': {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      },
      activeWallet: 'wallet-b'
    }))

    expect(screen.getByTestId('wallet-status-wallet-a')).toHaveTextContent('Connected')
    expect(screen.getByTestId('wallet-status-wallet-b')).toHaveTextContent('Active')

    // Set active network to mainnet
    mockWalletManager.store.setState((state) => ({
      ...state,
      activeNetwork: NetworkId.MAINNET
    }))

    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.MAINNET)
  })

  it('wallet properties update reactively via getters', () => {
    const WalletStatus = (props: { wallet: any }) => {
      return (
        <div>
          <span data-testid={`reactive-connected-${props.wallet.id}`}>
            {props.wallet.isConnected ? 'yes' : 'no'}
          </span>
          <span data-testid={`reactive-active-${props.wallet.id}`}>
            {props.wallet.isActive ? 'yes' : 'no'}
          </span>
          <span data-testid={`reactive-accounts-${props.wallet.id}`}>
            {props.wallet.accounts.length}
          </span>
          <span data-testid={`reactive-active-account-${props.wallet.id}`}>
            {props.wallet.activeAccount?.address ?? 'none'}
          </span>
        </div>
      )
    }

    const ReactiveTestComponent = () => {
      const { wallets } = useWallet()
      return <For each={wallets()}>{(wallet) => <WalletStatus wallet={wallet} />}</For>
    }

    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <ReactiveTestComponent />
      </WalletProvider>
    ))

    // Initially disconnected
    expect(screen.getByTestId('reactive-connected-wallet-a')).toHaveTextContent('no')
    expect(screen.getByTestId('reactive-active-wallet-a')).toHaveTextContent('no')
    expect(screen.getByTestId('reactive-accounts-wallet-a')).toHaveTextContent('0')
    expect(screen.getByTestId('reactive-active-account-wallet-a')).toHaveTextContent('none')

    // Connect wallet-a
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-a': {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      },
      activeWallet: 'wallet-a'
    }))

    expect(screen.getByTestId('reactive-connected-wallet-a')).toHaveTextContent('yes')
    expect(screen.getByTestId('reactive-active-wallet-a')).toHaveTextContent('yes')
    expect(screen.getByTestId('reactive-accounts-wallet-a')).toHaveTextContent('2')
    expect(screen.getByTestId('reactive-active-account-wallet-a')).toHaveTextContent('address1')

    // Switch active to wallet-b
    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        'wallet-b': {
          accounts: [testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: 'wallet-b'
    }))

    // wallet-a should now be connected but not active
    expect(screen.getByTestId('reactive-connected-wallet-a')).toHaveTextContent('yes')
    expect(screen.getByTestId('reactive-active-wallet-a')).toHaveTextContent('no')
    // wallet-b should be active
    expect(screen.getByTestId('reactive-connected-wallet-b')).toHaveTextContent('yes')
    expect(screen.getByTestId('reactive-active-wallet-b')).toHaveTextContent('yes')

    // Disconnect wallet-a
    mockWalletManager.store.setState((state) => {
      const { 'wallet-a': _, ...rest } = state.wallets
      return { ...state, wallets: rest }
    })

    expect(screen.getByTestId('reactive-connected-wallet-a')).toHaveTextContent('no')
    expect(screen.getByTestId('reactive-active-wallet-a')).toHaveTextContent('no')
    expect(screen.getByTestId('reactive-accounts-wallet-a')).toHaveTextContent('0')
  })

  it('initializes with isReady false and updates after resumeSessions', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    // Initially should not be ready
    expect(screen.getByTestId('is-ready')).toHaveTextContent('false')

    // Simulate manager status change
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    // Should be ready after status change
    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('true')
    })
  })

  it('updates isReady when manager status changes', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('is-ready')).toHaveTextContent('false')

    // Simulate manager status change
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('true')
    })

    // Simulate manager status change back to initializing
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

    await waitFor(() => {
      expect(screen.getByTestId('is-ready')).toHaveTextContent('false')
    })
  })
})

describe('useWallet - availableWallets', () => {
  it('filters wallets by active network capabilities', () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    const TestComponent = () => {
      const { wallets, availableWallets } = useWallet()
      return (
        <div>
          <div data-testid="wallets-count">{wallets().length}</div>
          <div data-testid="available-count">{availableWallets().length}</div>
          <div data-testid="available-ids">
            {availableWallets()
              .map((w) => w.id)
              .join(',')}
          </div>
        </div>
      )
    }

    render(() => (
      <WalletProvider manager={manager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('wallets-count')).toHaveTextContent('2')
    expect(screen.getByTestId('available-count')).toHaveTextContent('1')
    expect(screen.getByTestId('available-ids')).toHaveTextContent('wallet-b')
  })

  it('re-filters when active network changes', async () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    const TestComponent = () => {
      const { availableWallets } = useWallet()
      return <div data-testid="available-count">{availableWallets().length}</div>
    }

    render(() => (
      <WalletProvider manager={manager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('available-count')).toHaveTextContent('1')

    await manager.setActiveNetwork('mainnet')

    await waitFor(() => {
      expect(screen.getByTestId('available-count')).toHaveTextContent('2')
    })
  })
})
