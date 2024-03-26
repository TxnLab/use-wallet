import { Store } from '@tanstack/react-store'
import { renderHook, act, render } from '@testing-library/react'
import {
  BaseWallet,
  DeflyWallet,
  NetworkId,
  WalletManager,
  WalletId,
  defaultState,
  type State,
  type WalletAccount,
  PeraWallet
} from '@txnlab/use-wallet-js'
import React from 'react'
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

vi.mock('@txnlab/use-wallet-js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@txnlab/use-wallet-js')>()
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

const mockStore = new Store<State>(defaultState)

const mockDeflyWallet = new DeflyWallet({
  id: WalletId.DEFLY,
  metadata: { name: 'Defly', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: mockSubscribe
})

const mockPeraWallet = new PeraWallet({
  id: WalletId.PERA,
  metadata: { name: 'Pera', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: mockSubscribe
})

describe('useWallet', () => {
  let mockWalletManager: WalletManager
  let mockWallets: Wallet[]
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore.setState(() => defaultState)

    mockWalletManager = new WalletManager()
    mockWallets = [
      {
        id: mockDeflyWallet.id,
        metadata: mockDeflyWallet.metadata,
        accounts: [],
        activeAccount: null,
        isConnected: false,
        isActive: false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function)
      },
      {
        id: mockPeraWallet.id,
        metadata: mockPeraWallet.metadata,
        accounts: [],
        activeAccount: null,
        isConnected: false,
        isActive: false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function)
      }
    ]
    mockWalletManager._clients = new Map<WalletId, BaseWallet>([
      [WalletId.DEFLY, mockDeflyWallet],
      [WalletId.PERA, mockPeraWallet]
    ])
    mockWalletManager.store = mockStore

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <WalletProvider manager={mockWalletManager}>{children}</WalletProvider>
    )
  })

  it('initializes wallets and active wallet correctly', () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    expect(result.current.wallets).toEqual(mockWallets)
    expect(result.current.activeWallet).toBeNull()
    expect(result.current.activeAccount).toBeNull()
    expect(result.current.activeNetwork).toBe(NetworkId.TESTNET)
  })

  it('correctly handles wallet connect/disconnect', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    // Simulate connect and disconnect
    await act(async () => {
      await result.current.wallets[0].connect()
      await result.current.wallets[0].disconnect()
    })

    expect(mocks.connect).toHaveBeenCalled()
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls setActive and setActiveAccount correctly', () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    // Simulate calling setActive and setActiveAccount
    act(() => {
      result.current.wallets[0].setActive()
      result.current.wallets[0].setActiveAccount('some-address')
    })

    expect(mocks.setActive).toHaveBeenCalled()
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('some-address')
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    // Set an active wallet and account
    act(() => {
      mockStore.setState((state) => ({
        ...state,
        wallets: {
          [WalletId.DEFLY]: {
            accounts: [
              {
                name: 'Defly Account 1',
                address: 'address1'
              }
            ],
            activeAccount: {
              name: 'Defly Account 1',
              address: 'address1'
            }
          }
        },
        activeWallet: WalletId.DEFLY
      }))
    })

    // Simulate calling signTransactions and transactionSigner
    await act(async () => {
      await result.current.signTransactions([], [], true)
      await result.current.transactionSigner([], [])
    })

    expect(mocks.signTransactions).toHaveBeenCalledWith([], [], true)
    expect(mocks.transactionSigner).toHaveBeenCalledWith([], [])
  })

  it('updates wallets when store state changes', () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    // Mock a state change in the store
    act(() => {
      mockStore.setState((state) => ({
        ...state,
        wallets: {
          [WalletId.DEFLY]: {
            accounts: [
              {
                name: 'Defly Account 1',
                address: 'address1'
              },
              {
                name: 'Defly Account 2',
                address: 'address2'
              }
            ],
            activeAccount: {
              name: 'Defly Account 1',
              address: 'address1'
            }
          }
        },
        activeWallet: WalletId.DEFLY
      }))
    })

    expect(result.current.wallets).toEqual([
      {
        ...mockWallets[0],
        accounts: [
          {
            name: 'Defly Account 1',
            address: 'address1'
          },
          {
            name: 'Defly Account 2',
            address: 'address2'
          }
        ],
        activeAccount: {
          name: 'Defly Account 1',
          address: 'address1'
        },
        isConnected: true,
        isActive: true
      },
      mockWallets[1]
    ])
  })

  it('integrates correctly with a React component', () => {
    function TestComponent() {
      const {
        wallets,
        activeNetwork,
        activeWallet,
        activeWalletAccounts,
        activeWalletAddresses,
        activeAccount,
        activeAddress
      } = useWallet()

      return (
        <div>
          <ul>
            {wallets.map((wallet) => (
              <li key={wallet.id}>{wallet.metadata.name}</li>
            ))}
          </ul>
          <div data-testid="active-network">Active Network: {JSON.stringify(activeNetwork)}</div>
          <div data-testid="active-wallet">Active Wallet: {JSON.stringify(activeWallet)}</div>
          <div data-testid="active-wallet-accounts">
            Active Wallet Accounts: {JSON.stringify(activeWalletAccounts)}
          </div>
          <div data-testid="active-wallet-addresses">
            Active Wallet Addresses: {JSON.stringify(activeWalletAddresses)}
          </div>
          <div data-testid="active-account">Active Account: {JSON.stringify(activeAccount)}</div>
          <div data-testid="active-address">Active Address: {JSON.stringify(activeAddress)}</div>
        </div>
      )
    }

    const { getByTestId, getAllByRole } = render(
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    )

    const listItems = getAllByRole('listitem')

    mockWallets.forEach((wallet, index) => {
      expect(listItems[index]).toHaveTextContent(wallet.metadata.name)
    })

    expect(getByTestId('active-network')).toHaveTextContent(JSON.stringify(NetworkId.TESTNET))
    expect(getByTestId('active-wallet')).toHaveTextContent(JSON.stringify(null))
    expect(getByTestId('active-wallet-accounts')).toHaveTextContent(JSON.stringify(null))
    expect(getByTestId('active-wallet-addresses')).toHaveTextContent(JSON.stringify(null))
    expect(getByTestId('active-account')).toHaveTextContent(JSON.stringify(null))
    expect(getByTestId('active-address')).toHaveTextContent(JSON.stringify(null))

    // Mock a state change in the store
    act(() => {
      mockStore.setState((state) => ({
        ...state,
        wallets: {
          [WalletId.DEFLY]: {
            accounts: [
              {
                name: 'Defly Account 1',
                address: 'address1'
              }
            ],
            activeAccount: {
              name: 'Defly Account 1',
              address: 'address1'
            }
          }
        },
        activeWallet: WalletId.DEFLY
      }))
    })

    expect(getByTestId('active-network')).toHaveTextContent(JSON.stringify(NetworkId.TESTNET))
    expect(getByTestId('active-wallet')).toHaveTextContent(JSON.stringify(WalletId.DEFLY))
    expect(getByTestId('active-wallet-accounts')).toHaveTextContent(
      JSON.stringify([
        {
          name: 'Defly Account 1',
          address: 'address1'
        }
      ])
    )
    expect(getByTestId('active-wallet-addresses')).toHaveTextContent(JSON.stringify(['address1']))
    expect(getByTestId('active-account')).toHaveTextContent(
      JSON.stringify({
        name: 'Defly Account 1',
        address: 'address1'
      })
    )
    expect(getByTestId('active-address')).toHaveTextContent(JSON.stringify('address1'))
  })
})
