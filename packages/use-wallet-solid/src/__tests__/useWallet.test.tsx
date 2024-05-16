import { fireEvent, render, screen } from '@solidjs/testing-library'
import { Store } from '@tanstack/solid-store'
import {
  BaseWallet,
  DeflyWallet,
  NetworkId,
  WalletManager,
  WalletId,
  type State,
  type WalletAccount,
  PeraWallet
} from '@txnlab/use-wallet'
import { For } from 'solid-js'
import { Wallet, useWallet } from '../useWallet'
import { WalletProvider } from '../WalletProvider'

const mocks = vi.hoisted(() => {
  return {
    connect: vi.fn(() => Promise.resolve([] as WalletAccount[])),
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
    PeraWallet: class extends mod.BaseWallet {
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

const mockSubscribe: (callback: (state: State) => void) => () => void = vi.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (callback: (state: State) => void) => {
    return () => console.log('unsubscribe')
  }
)

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
    wallets
  } = useWallet()

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
              onClick={() => wallet.connect()}
              disabled={isWalletConnected(wallet.id)}
            >
              Connect
            </button>
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
              onClick={() => wallet.setActiveAccount(wallet.accounts[1].address)}
              disabled={!isWalletActive(wallet.id) || !isWalletConnected(wallet.id)}
            >
              Set Active Account
            </button>
            <button
              data-testid={`sign-transactions-btn-${wallet.id}`}
              onClick={() => wallet.signTransactions([], [], true)}
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
  let mockPeraWallet: PeraWallet
  let mockWallets: Wallet[]

  beforeEach(() => {
    vi.clearAllMocks()

    const defaultState = {
      wallets: {},
      activeWallet: null,
      activeNetwork: NetworkId.TESTNET
    }

    mockStore = new Store<State>(defaultState)

    mockDeflyWallet = new DeflyWallet({
      id: WalletId.DEFLY,
      metadata: { name: 'Defly', icon: 'icon' },
      getAlgodClient: () => ({}) as any,
      store: mockStore,
      subscribe: mockSubscribe
    })

    mockPeraWallet = new PeraWallet({
      id: WalletId.PERA,
      metadata: { name: 'Pera', icon: 'icon' },
      getAlgodClient: () => ({}) as any,
      store: mockStore,
      subscribe: mockSubscribe
    })

    mockWalletManager = new WalletManager()
    mockWalletManager._clients = new Map<WalletId, BaseWallet>([
      [WalletId.DEFLY, mockDeflyWallet],
      [WalletId.PERA, mockPeraWallet]
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
        id: () => mockPeraWallet.id,
        metadata: () => mockPeraWallet.metadata,
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

    // Trigger connect
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
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    // Trigger disconnect
    const disconnectButton = screen.getByTestId('disconnect-btn-defly')
    fireEvent.click(disconnectButton)
    expect(mocks.disconnect).toHaveBeenCalled()
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
          activeAccount: testAccount1
        },
        [WalletId.PERA]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    const setActiveButton = screen.getByTestId('set-active-btn-pera')
    fireEvent.click(setActiveButton)
    expect(mocks.setActive).toHaveBeenCalled()

    mockStore.setState((state) => ({
      ...state,
      activeWallet: WalletId.PERA
    }))

    const setActiveAccountButton = screen.getByTestId('set-active-account-btn-pera')
    fireEvent.click(setActiveAccountButton)
    expect(mocks.setActiveAccount).toHaveBeenCalledWith(testAccount2.address)
  })

  it('calls setActiveNetwork correctly', () => {
    render(() => (
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    ))

    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.TESTNET)

    const setActiveNetworkButton = screen.getByTestId('set-active-network-btn')
    fireEvent.click(setActiveNetworkButton)
    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.MAINNET)
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
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    const signTransactionsButton = screen.getByTestId('sign-transactions-btn-defly')
    fireEvent.click(signTransactionsButton)
    expect(mocks.signTransactions).toHaveBeenCalledWith([], [], true)

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
    expect(screen.getByTestId('wallet-name-pera')).toHaveTextContent('Pera')
    expect(screen.getByTestId('wallet-status-pera')).toHaveTextContent('Disconnected')

    // Simulate Defly wallet connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.DEFLY
    }))

    expect(screen.getByTestId('active-account')).toHaveTextContent(JSON.stringify(testAccount1))
    expect(screen.getByTestId('active-address')).toHaveTextContent(testAccount1.address)
    expect(screen.getByTestId('active-wallet')).toHaveTextContent(WalletId.DEFLY)
    expect(screen.getByTestId('active-wallet-accounts')).toHaveTextContent(
      JSON.stringify([testAccount1, testAccount2])
    )
    expect(screen.getByTestId('active-wallet-addresses')).toHaveTextContent('address1, address2')
    expect(screen.getByTestId('active-wallet-id')).toHaveTextContent(WalletId.DEFLY)
    expect(screen.getByTestId('active-wallet-state')).toHaveTextContent(
      JSON.stringify({
        accounts: [testAccount1, testAccount2],
        activeAccount: testAccount1
      })
    )
    expect(screen.getByTestId('wallet-store')).toHaveTextContent(
      JSON.stringify({
        [WalletId.DEFLY]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      })
    )
    expect(screen.getByTestId('wallet-status-defly')).toHaveTextContent('Active')
    expect(screen.getByTestId('wallet-status-pera')).toHaveTextContent('Disconnected')

    // Simulate Pera wallet connection
    mockStore.setState((state) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [WalletId.PERA]: {
          accounts: [testAccount1, testAccount2],
          activeAccount: testAccount1
        }
      },
      activeWallet: WalletId.PERA
    }))

    expect(screen.getByTestId('wallet-status-defly')).toHaveTextContent('Connected')
    expect(screen.getByTestId('wallet-status-pera')).toHaveTextContent('Active')

    // Set active network to mainnet
    mockStore.setState((state) => ({
      ...state,
      activeNetwork: NetworkId.MAINNET
    }))

    expect(screen.getByTestId('active-network')).toHaveTextContent(NetworkId.MAINNET)
  })
})
