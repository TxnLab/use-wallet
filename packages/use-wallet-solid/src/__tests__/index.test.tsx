import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { Store } from '@tanstack/solid-store'
import {
  BaseWallet,
  DeflyWallet,
  MagicAuth,
  NetworkId,
  WalletManager,
  WalletId,
  DEFAULT_STATE,
  type State,
  type WalletAccount
} from '@txnlab/use-wallet'
import { For, Show, createSignal } from 'solid-js'
import { Wallet, WalletProvider, useWallet, useWalletManager } from '../index'
import algosdk from 'algosdk'

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

vi.mock('@txnlab/use-wallet', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@txnlab/use-wallet')>()
  return {
    ...mod,
    DeflyWallet: class extends mod.BaseWallet {
      connect = mocks.connect
      disconnect = mocks.disconnect
      setActive = mocks.setActive
      setActiveAccount = mocks.setActiveAccount
      resumeSession = mocks.resumeSession
      signTransactions = mocks.signTransactions
      transactionSigner = mocks.transactionSigner
    },
    MagicAuth: class extends mod.BaseWallet {
      connect = mocks.connect
      disconnect = mocks.disconnect
      setActive = mocks.setActive
      setActiveAccount = mocks.setActiveAccount
      resumeSession = mocks.resumeSession
      signTransactions = mocks.signTransactions
      transactionSigner = mocks.transactionSigner
    }
  }
})

const testAccount1 = { name: 'Account 1', address: 'address1' }
const testAccount2 = { name: 'Account 2', address: 'address2' }

const TestComponent = () => {
  const {
    activeAccount,
    activeAddress,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeWalletId,
    activeWalletState,
    setActiveNetwork,
    isWalletActive,
    isWalletConnected,
    walletStore,
    wallets,
    algodClient
  } = useWallet()

  const [magicEmail, setMagicEmail] = createSignal('')

  const getConnectArgs = (wallet: BaseWallet) => {
    if (wallet.id === WalletId.MAGIC) {
      return { email: magicEmail() }
    }
    return undefined
  }

  return (
    <div>
      <div data-testid="active-account">{JSON.stringify(activeAccount())}</div>
      <div data-testid="active-address">{JSON.stringify(activeAddress())}</div>
      <div data-testid="active-network">{activeNetwork()}</div>
      <div data-testid="active-wallet">{JSON.stringify(activeWallet()?.id || 'null')}</div>
      <div data-testid="active-wallet-accounts">{JSON.stringify(activeWalletAccounts())}</div>
      <div data-testid="active-wallet-addresses">
        {activeWalletAddresses()?.join(', ') || 'null'}
      </div>
      <div data-testid="active-wallet-id">{JSON.stringify(activeWalletId())}</div>
      <div data-testid="active-wallet-state">{JSON.stringify(activeWalletState())}</div>
      <div data-testid="wallet-store">{JSON.stringify(walletStore())}</div>
      <div data-testid="wallets">{wallets.map((wallet) => wallet.id).join(', ')}</div>
      <div data-testid="algod-client">{JSON.stringify(algodClient())}</div>

      <For each={wallets}>
        {(wallet) => (
          <div data-testid="wallet">
            <h4 data-testid={`wallet-name-${wallet.id}`}>{wallet.metadata.name}</h4>
            <p data-testid={`wallet-status-${wallet.id}`}>
              {isWalletActive(wallet.id)
                ? 'Active'
                : isWalletConnected(wallet.id)
                  ? 'Connected'
                  : 'Disconnected'}
            </p>
            <button
              data-testid={`connect-btn-${wallet.id}`}
              onClick={() => wallet.connect(getConnectArgs(wallet))}
              disabled={isWalletConnected(wallet.id)}
            >
              Connect
            </button>
            <Show when={wallet.id === WalletId.MAGIC}>
              <input
                data-testid="magic-email"
                type="email"
                value={magicEmail()}
                onInput={(e) => setMagicEmail(e.target.value)}
                placeholder="Enter email to connect..."
                disabled={isWalletConnected(wallet.id)}
              />
            </Show>
            <button
              data-testid={`disconnect-btn-${wallet.id}`}
              onClick={() => wallet.disconnect()}
              disabled={!isWalletConnected(wallet.id)}
            >
              Disconnect
            </button>
            <button
              data-testid={`set-active-btn-${wallet.id}`}
              onClick={() => wallet.setActive()}
              disabled={isWalletActive(wallet.id)}
            >
              Set Active
            </button>
            <button
              data-testid={`set-active-account-btn-${wallet.id}`}
              onClick={() => wallet.setActiveAccount(wallet.accounts[0].address)}
              disabled={!isWalletActive(wallet.id) || !isWalletConnected(wallet.id)}
            >
              Set Active Account
            </button>
            <button
              data-testid={`sign-transactions-btn-${wallet.id}`}
              onClick={() => wallet.signTransactions([], [])}
              disabled={!isWalletActive(wallet.id)}
            >
              Sign Transactions
            </button>
            <button
              data-testid={`transaction-signer-btn-${wallet.id}`}
              onClick={() => wallet.transactionSigner([], [])}
              disabled={!isWalletActive(wallet.id)}
            >
              Transaction Signer
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

describe('useWallet', () => {
  let mockStore: Store<State, (cb: State) => State>
  let mockWalletManager: WalletManager
  let mockDeflyWallet: DeflyWallet
  let mockMagicAuth: MagicAuth
  let mockWallets: Wallet[]
  let mockSetAlgodClient: (client: algosdk.Algodv2) => void
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let mockAlgodClient: algosdk.Algodv2

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore = new Store<State>(DEFAULT_STATE)

    mockDeflyWallet = new DeflyWallet({
      id: WalletId.DEFLY,
      metadata: { name: 'Defly', icon: 'icon' },
      getAlgodClient: () => ({}) as any,
      store: mockStore,
      subscribe: vi.fn()
    })

    mockMagicAuth = new MagicAuth({
      id: WalletId.MAGIC,
      metadata: { name: 'Magic', icon: 'icon' },
      getAlgodClient: () => ({}) as any,
      store: mockStore,
      subscribe: vi.fn()
    })

    mockWalletManager = new WalletManager()
    mockWalletManager._clients = new Map<WalletId, BaseWallet>([
      [WalletId.DEFLY, mockDeflyWallet],
      [WalletId.MAGIC, mockMagicAuth]
    ])
    mockWalletManager.store = mockStore

    mockWallets = [
      {
        id: () => mockDeflyWallet.id,
        metadata: () => mockDeflyWallet.metadata,
        accounts: () => [],
        activeAccount: () => null,
        isConnected: () => false,
        isActive: () => false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function)
      },
      {
        id: () => mockMagicAuth.id,
        metadata: () => mockMagicAuth.metadata,
        accounts: () => [],
        activeAccount: () => null,
        isConnected: () => false,
        isActive: () => false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function)
      }
    ]

    mockAlgodClient = new algosdk.Algodv2('token', 'https://server', '')

    mockSetAlgodClient = (client: algosdk.Algodv2) => {
      mockAlgodClient = client
    }
  })

  it('initializes wallets and active wallet correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))
    expect(screen.getByTestId('wallets')).toHaveTextContent(
      mockWallets.map((wallet) => wallet.id()).join(', ')
    )
    expect(screen.getAllByTestId('wallet')).toHaveLength(2)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent('null')
    expect(screen.getByTestId('active-account')).toHaveTextContent('null')
    expect(screen.getByTestId('wallet-store')).toHaveTextContent('{}')
    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.TESTNET)
  })

  it('calls connect and disconnect correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    // Trigger connect for Defly wallet
    const connectButton = screen.getByTestId('connect-btn-defly')
    fireEvent.click(connectButton)
    expect(mocks.connect).toHaveBeenCalled()

    // Simulate Defly wallet connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    // Trigger disconnect
    const disconnectButton = screen.getByTestId('disconnect-btn-defly')
    fireEvent.click(disconnectButton)
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls connect with email for Magic wallet', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    // Set the email address
    const emailInput = screen.getByTestId('magic-email') as HTMLInputElement
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } })

    // Trigger connect for Magic wallet
    const connectButton = screen.getByTestId('connect-btn-magic')
    fireEvent.click(connectButton)

    // Assert that connect was called with the email address
    expect(mocks.connect).toHaveBeenCalledWith({ email: 'test@example.com' })
  })

  it('calls setActive and setActiveAccount correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        },
        [WalletId.MAGIC]: {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    const setActiveButton = screen.getByTestId('set-active-btn-magic')
    fireEvent.click(setActiveButton)
    expect(mocks.setActive).toHaveBeenCalled()

    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.MAGIC
    }))

    const setActiveAccountButton = screen.getByTestId('set-active-account-btn-magic')
    fireEvent.click(setActiveAccountButton)
    expect(mocks.setActiveAccount).toHaveBeenCalledWith(testAccount1.address)
  })

  it('calls setActiveNetwork correctly', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.TESTNET)

    const setActiveNetworkButton = screen.getByTestId('set-active-network-btn')
    fireEvent.click(setActiveNetworkButton)

    await waitFor(() => {
      expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.MAINNET)
    })
  })

  // it('reactively updates the algodClient', async () => {
  //   render(() => (
  //     <WalletProvider manager={mockWalletManager}>
  //       <TestComponent />
  //     </WalletProvider>
  //   ))

  //   const newAlgodClient = new algosdk.Algodv2('new-token', 'https://new-server', '')

  //   const setAlgodClientButton = screen.getByTestId('set-algod-client-btn')
  //   fireEvent.click(setAlgodClientButton)

  //   // Wait for state update
  //   await waitFor(() => {
  //     expect(screen.getByTestId('algod-client')).toHaveTextContent(JSON.stringify(newAlgodClient))
  //   })
  // })

  it('updates algodClient when setActiveNetwork is called', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    const newAlgodClient = new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev/', '')

    mockWalletManager.setActiveNetwork = async (networkId: NetworkId) => {
      mockSetAlgodClient(newAlgodClient)
      mockWalletManager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId
      }))
    }

    const setActiveNetworkButton = screen.getByTestId('set-active-network-btn')
    fireEvent.click(setActiveNetworkButton)

    // Wait for state update
    await waitFor(() => {
      expect(screen.getByTestId('algod-client')).toHaveTextContent(JSON.stringify(newAlgodClient))
    })
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    const signTransactionsButton = screen.getByTestId('sign-transactions-btn-defly')
    fireEvent.click(signTransactionsButton)
    expect(mocks.signTransactions).toHaveBeenCalledWith([], [])

    const transactionSignerButton = screen.getByTestId('transaction-signer-btn-defly')
    fireEvent.click(transactionSignerButton)
    expect(mocks.transactionSigner).toHaveBeenCalledWith([], [])
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
    expect(screen.getByTestId('active-wallet-id')).toHaveTextContent('null')
    expect(screen.getByTestId('active-wallet-state')).toHaveTextContent('null')
    expect(screen.getByTestId('wallet-store')).toHaveTextContent('{}')
    expect(screen.getByTestId('wallets')).toHaveTextContent(
      mockWallets.map((wallet) => wallet.id()).join(', ')
    )
    expect(screen.getAllByTestId('wallet')).toHaveLength(2)
    expect(screen.getByTestId('wallet-name-defly')).toHaveTextContent('Defly')
    expect(screen.getByTestId('wallet-status-defly')).toHaveTextContent('Disconnected')
    expect(screen.getByTestId('wallet-name-magic')).toHaveTextContent('Magic')
    expect(screen.getByTestId('wallet-status-magic')).toHaveTextContent('Disconnected')

    // Simulate Defly wallet connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    expect(screen.getByTestId('active-account')).toHaveTextContent(JSON.stringify(testAccount2))
    expect(screen.getByTestId('active-address')).toHaveTextContent(testAccount2.address)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent(WalletId.DEFLY)
    expect(screen.getByTestId('active-wallet-accounts')).toHaveTextContent(
      JSON.stringify([testAccount1, testAccount2])
    )
    expect(screen.getByTestId('active-wallet-addresses')).toHaveTextContent('address1, address2')
    expect(screen.getByTestId('active-wallet-id')).toHaveTextContent(WalletId.DEFLY)
    expect(screen.getByTestId('active-wallet-state')).toHaveTextContent(
      JSON.stringify({
        accounts: [testAccount1, testAccount2],
        activeAccount: testAccount2
      })
    )
    expect(screen.getByTestId('wallet-store')).toHaveTextContent(
      JSON.stringify({
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount2
        }
      })
    )
    expect(screen.getByTestId('wallet-status-defly')).toHaveTextContent('Active')
    expect(screen.getByTestId('wallet-status-magic')).toHaveTextContent('Disconnected')

    // Simulate Magic wallet connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.MAGIC]: {
          accounts: [testAccount1],
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.MAGIC
    }))

    expect(screen.getByTestId('wallet-status-defly')).toHaveTextContent('Connected')
    expect(screen.getByTestId('wallet-status-magic')).toHaveTextContent('Active')

    // Set active network to mainnet
    mockStore.setState((state) => ({
      ...state,
      activeNetwork: NetworkId.MAINNET
    }))

    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.MAINNET)
  })
})

describe('WalletProvider', () => {
  it('provides the WalletManager to its children', () => {
    const TestComponent = () => {
      const manager = useWalletManager()
      return <h1>{manager ? 'Manager provided' : 'No manager'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY]
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
