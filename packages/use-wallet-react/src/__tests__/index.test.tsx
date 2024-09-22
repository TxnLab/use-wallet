import { Store } from '@tanstack/react-store'
import { renderHook, act, render, screen } from '@testing-library/react'
import {
  BaseWallet,
  DeflyWallet,
  MagicAuth,
  NetworkId,
  WalletManager,
  WalletId,
  defaultState,
  type State,
  type WalletAccount
} from 'avm-wallet'
import * as React from 'react'
import { Wallet, WalletProvider, useWallet } from '../index'
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

vi.mock('avm-wallet', async (importOriginal) => {
  const mod = await importOriginal<typeof import('avm-wallet')>()
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

const mockStore = new Store<State>(defaultState)

const mockDeflyWallet = new DeflyWallet({
  id: WalletId.DEFLY,
  metadata: { name: 'Defly', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn()
})

const mockMagicAuth = new MagicAuth({
  id: WalletId.MAGIC,
  options: {
    apiKey: 'api-key'
  },
  metadata: { name: 'Magic', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn()
})

describe('WalletProvider', () => {
  it('provides the wallet context to its children', () => {
    const TestComponent = () => {
      const { wallets } = useWallet()
      return <h1>{wallets ? 'Context provided' : 'No context'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY]
    })

    render(
      <WalletProvider manager={walletManager}>
        <TestComponent />
      </WalletProvider>
    )

    expect(screen.getByText('Context provided')).toBeInTheDocument()
  })

  it('throws an error when useWallet is used outside of WalletProvider', () => {
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

  it('calls resumeSessions on mount', async () => {
    const mockResumeSessions = vi.fn()
    const fakeManager = { resumeSessions: mockResumeSessions }

    render(
      <WalletProvider manager={fakeManager as unknown as WalletManager}>
        <div />
      </WalletProvider>
    )

    expect(mockResumeSessions).toHaveBeenCalled()
  })

  it('updates algodClient when setAlgodClient is called', () => {
    const newAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')
    const TestComponent = () => {
      const { setAlgodClient } = useWallet()
      React.useEffect(() => {
        setAlgodClient(newAlgodClient)
      }, [setAlgodClient])
      return null
    }

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY]
    })

    render(
      <WalletProvider manager={walletManager}>
        <TestComponent />
      </WalletProvider>
    )

    expect(walletManager.algodClient).toBe(newAlgodClient)
  })

  it('updates activeNetwork and algodClient when setActiveNetwork is called', async () => {
    const newNetwork = NetworkId.MAINNET

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY],
      network: NetworkId.TESTNET
    })

    const TestComponent = () => {
      const { setActiveNetwork } = useWallet()
      return <button onClick={() => setActiveNetwork(newNetwork)}>Change Network</button>
    }

    render(
      <WalletProvider manager={walletManager}>
        <TestComponent />
      </WalletProvider>
    )

    await act(async () => {
      screen.getByText('Change Network').click()
    })

    expect(walletManager.store.state.activeNetwork).toBe(newNetwork)
    const { token, baseServer, port, headers } = walletManager.networkConfig[newNetwork]
    expect(walletManager.algodClient).toEqual(new algosdk.Algodv2(token, baseServer, port, headers))
  })
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
        id: mockMagicAuth.id,
        metadata: mockMagicAuth.metadata,
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
      [WalletId.MAGIC, mockMagicAuth]
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

    const defly = result.current.wallets[0]
    const magic = result.current.wallets[1]

    // Simulate connect and disconnect for Defly (no args)
    await act(async () => {
      await defly.connect()
      await defly.disconnect()
    })

    expect(mocks.connect).toHaveBeenCalledWith(undefined)
    expect(mocks.disconnect).toHaveBeenCalled()

    // Simulate connect and disconnect for Magic (with email)
    await act(async () => {
      await magic.connect({ email: 'test@example.com' })
      await magic.disconnect()
    })

    expect(mocks.connect).toHaveBeenCalledWith({ email: 'test@example.com' })
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
      await result.current.signTransactions([], [])
      await result.current.transactionSigner([], [])
    })

    expect(mocks.signTransactions).toHaveBeenCalledWith([], [])
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

  it('calls setAlgodClient correctly', () => {
    const newAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')
    const { result } = renderHook(() => useWallet(), { wrapper })

    act(() => {
      result.current.setAlgodClient(newAlgodClient)
    })

    expect(result.current.algodClient).toBe(newAlgodClient)
  })

  it('calls setActiveNetwork correctly and updates algodClient', async () => {
    const newNetwork = NetworkId.MAINNET
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      await result.current.setActiveNetwork(newNetwork)
    })

    expect(result.current.activeNetwork).toBe(newNetwork)
    const { token, baseServer, port, headers } = mockWalletManager.networkConfig[newNetwork]
    expect(result.current.algodClient).toEqual(
      new algosdk.Algodv2(token, baseServer, port, headers)
    )
  })
})
