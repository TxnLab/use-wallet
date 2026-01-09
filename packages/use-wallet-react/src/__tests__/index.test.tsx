import { Store } from '@tanstack/react-store'
import { renderHook, act, render, screen } from '@testing-library/react'
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
import algosdk from 'algosdk'
import * as React from 'react'
import { Wallet, WalletProvider, useWallet, useNetwork } from '../index'

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

const mockStore = new Store<State>(DEFAULT_STATE)

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
  it('provides context to child components', async () => {
    const TestComponent = () => {
      const { wallets } = useWallet()
      return <h1>{wallets ? 'Context provided' : 'No context'}</h1>
    }

    const walletManager = new WalletManager({
      wallets: [WalletId.DEFLY]
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
    mockStore.setState(() => DEFAULT_STATE)
    mockWalletManager = new WalletManager()
    mockWalletManager.store = mockStore

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
    const { algod } = mockWalletManager.networkConfig[newNetwork]
    const { token, baseServer, port, headers } = algod
    expect(mockWalletManager.algodClient).toEqual(
      new algosdk.Algodv2(token, baseServer, port, headers)
    )
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

  it('allows setting custom network that exists in config', async () => {
    const customNetwork = {
      algod: {
        token: '',
        baseServer: 'https://custom.network',
        headers: {}
      }
    }

    mockWalletManager.networkConfig['custom-net'] = customNetwork
    const { result } = renderHook(() => useNetwork(), { wrapper })

    await act(async () => {
      await result.current.setActiveNetwork('custom-net')
    })

    expect(result.current.activeNetwork).toBe('custom-net')
  })

  it('initializes network correctly', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper })

    expect(result.current.activeNetwork).toBe(NetworkId.TESTNET)
  })

  it('updates activeNetworkConfig when switching networks', async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper })
    const newNetwork = NetworkId.MAINNET

    await act(async () => {
      await result.current.setActiveNetwork(newNetwork)
    })

    expect(result.current.activeNetworkConfig).toBe(mockWalletManager.networkConfig[newNetwork])
  })

  it('updates activeNetworkConfig when updating network configuration', async () => {
    // Combine hooks into a single component to ensure shared context
    const useTestHooks = () => {
      const network = useNetwork()
      const wallet = useWallet()
      return { network, wallet }
    }

    const { result } = renderHook(() => useTestHooks(), { wrapper })

    const networkId = NetworkId.TESTNET
    const config = { baseServer: 'https://new-server.com' }
    const expectedClient = new algosdk.Algodv2('', 'https://new-server.com', '')

    await act(async () => {
      result.current.network.updateAlgodConfig(networkId, config)
    })

    expect(mockWalletManager.networkConfig[networkId].algod.baseServer).toBe(config.baseServer)
    expect(result.current.wallet.algodClient).toEqual(expectedClient)
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

  it('updates algodClient when resetting active network', () => {
    const createAlgodClientSpy = vi.spyOn(mockWalletManager as any, 'createAlgodClient')
    const { result } = renderHook(() => useNetwork(), { wrapper })

    // Modify the config
    act(() => {
      result.current.updateAlgodConfig(NetworkId.TESTNET, {
        token: 'custom-token',
        baseServer: 'https://custom-server.com'
      })
    })

    // Clear previous calls
    createAlgodClientSpy.mockClear()

    // Then reset it
    act(() => {
      result.current.resetNetworkConfig(NetworkId.TESTNET)
    })

    // Verify new algod client was created
    const algodConfig = mockWalletManager.networkConfig[NetworkId.TESTNET].algod
    expect(createAlgodClientSpy).toHaveBeenCalledWith(algodConfig)
  })

  it('updates algodClient when updating active network config', async () => {
    const useTestHooks = () => {
      const network = useNetwork()
      const wallet = useWallet()
      return { network, wallet }
    }

    const { result } = renderHook(() => useTestHooks(), { wrapper })

    const networkId = NetworkId.TESTNET
    const newConfig = { baseServer: 'https://new-server.com' }
    const expectedClient = new algosdk.Algodv2('', 'https://new-server.com', '')

    await act(async () => {
      result.current.network.updateAlgodConfig(networkId, newConfig)
    })

    expect(mockWalletManager.networkConfig[networkId].algod.baseServer).toBe(newConfig.baseServer)
    expect(result.current.wallet.algodClient).toEqual(expectedClient)
  })

  it('does not update algodClient when updating inactive network config', async () => {
    const { result: networkResult } = renderHook(() => useNetwork(), { wrapper })
    const { result: walletResult } = renderHook(() => useWallet(), { wrapper })

    const initialClient = walletResult.current.algodClient
    const networkId = NetworkId.MAINNET // Not the active network
    const newConfig = { baseServer: 'https://new-server.com' }

    await act(async () => {
      networkResult.current.updateAlgodConfig(networkId, newConfig)
    })

    expect(mockWalletManager.networkConfig[networkId].algod.baseServer).toBe(newConfig.baseServer)
    expect(walletResult.current.algodClient).toBe(initialClient)
  })

  it('updates algodClient when resetting active network config', async () => {
    const { result: networkResult } = renderHook(() => useNetwork(), { wrapper })
    const { result: walletResult } = renderHook(() => useWallet(), { wrapper })

    const networkId = NetworkId.TESTNET
    const defaultConfig = {
      algod: {
        baseServer: 'https://testnet-api.4160.nodely.dev',
        token: '',
        headers: {}
      },
      isTestnet: true,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisId: 'testnet-v1.0',
      caipChainId: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe'
    }
    const expectedClient = new algosdk.Algodv2(
      defaultConfig.algod.token,
      defaultConfig.algod.baseServer
    )

    // Modify the config
    await act(async () => {
      networkResult.current.updateAlgodConfig(networkId, {
        baseServer: 'https://modified-server.com'
      })
    })

    // Then reset it
    await act(async () => {
      networkResult.current.resetNetworkConfig(networkId)
    })

    expect(mockWalletManager.networkConfig[networkId]).toEqual(defaultConfig)
    expect(walletResult.current.algodClient).toEqual(expectedClient)
  })

  it('does not update algodClient when resetting inactive network config', async () => {
    const { result: networkResult } = renderHook(() => useNetwork(), { wrapper })
    const { result: walletResult } = renderHook(() => useWallet(), { wrapper })

    const initialClient = walletResult.current.algodClient
    const networkId = NetworkId.MAINNET // Not the active network

    // Modify the config
    await act(async () => {
      networkResult.current.updateAlgodConfig(networkId, {
        baseServer: 'https://modified-server.com'
      })
    })

    // Then reset it
    await act(async () => {
      networkResult.current.resetNetworkConfig(networkId)
    })

    expect(walletResult.current.algodClient).toBe(initialClient)
  })

  describe('setActiveNetwork', () => {
    it('calls setActiveNetwork correctly and updates algodClient', async () => {
      // Combine hooks into a single component for shared context
      const useTestHooks = () => {
        const network = useNetwork()
        const wallet = useWallet()
        return { network, wallet }
      }

      const { result } = renderHook(() => useTestHooks(), { wrapper })
      const newNetwork = NetworkId.MAINNET

      await act(async () => {
        await result.current.network.setActiveNetwork(newNetwork)
      })

      expect(result.current.network.activeNetwork).toBe(newNetwork)

      const { algod } = mockWalletManager.networkConfig[newNetwork]
      const { token, baseServer, port, headers } = algod
      expect(result.current.wallet.algodClient).toEqual(
        new algosdk.Algodv2(token, baseServer, port, headers)
      )
    })

    it('throws error for invalid network', async () => {
      const { result } = renderHook(() => useNetwork(), { wrapper })

      await expect(result.current.setActiveNetwork('invalid-network')).rejects.toThrow(
        'Network "invalid-network" not found in network configuration'
      )
    })
  })
})

describe('useWallet', () => {
  let mockWalletManager: WalletManager
  let mockWallets: Wallet[]
  let wrapper: React.FC<{ children: React.ReactNode }>

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore.setState(() => DEFAULT_STATE)

    mockWalletManager = new WalletManager()
    mockWallets = [
      {
        id: mockDeflyWallet.id,
        walletKey: mockDeflyWallet.walletKey,
        metadata: mockDeflyWallet.metadata,
        accounts: [],
        activeAccount: null,
        isConnected: false,
        isActive: false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function),
        canSignData: false
      },
      {
        id: mockMagicAuth.id,
        walletKey: mockMagicAuth.walletKey,
        metadata: mockMagicAuth.metadata,
        accounts: [],
        activeAccount: null,
        isConnected: false,
        isActive: false,
        connect: expect.any(Function),
        disconnect: expect.any(Function),
        setActive: expect.any(Function),
        setActiveAccount: expect.any(Function),
        canSignData: false
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
      // Wait for any initial effects to complete
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.wallets).toEqual(mockWallets)
    expect(result.current.activeWallet).toBeNull()
    expect(result.current.activeAccount).toBeNull()
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

  it('calls setActive and setActiveAccount correctly', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      // Get the Defly wallet from wallets array
      const deflyWallet = result.current.wallets.find((w) => w.id === WalletId.DEFLY)
      if (!deflyWallet) throw new Error('Defly wallet not found')

      deflyWallet.setActive()
    })

    expect(mocks.setActive).toHaveBeenCalled()

    await act(async () => {
      const deflyWallet = result.current.wallets.find((w) => w.id === WalletId.DEFLY)
      if (!deflyWallet) throw new Error('Defly wallet not found')

      deflyWallet.setActiveAccount('test-address')
    })

    expect(mocks.setActiveAccount).toHaveBeenCalledWith('test-address')
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

  it('updates wallets when store state changes', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      mockStore.setState((state) => ({
        ...state,
        wallets: {
          [WalletId.DEFLY]: {
            accounts: [{ name: 'Account 1', address: 'address1' }],
            activeAccount: { name: 'Account 1', address: 'address1' }
          }
        },
        activeWallet: WalletId.DEFLY
      }))
    })

    expect(result.current.activeWallet?.id).toBe(WalletId.DEFLY)
    expect(result.current.activeAddress).toBe('address1')
  })

  it('initializes with isReady false and updates after resumeSessions', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    expect(result.current.isReady).toBe(false)

    // Wait for resumeSessions to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(result.current.isReady).toBe(true)
  })

  it('updates isReady when manager status changes', async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    expect(result.current.isReady).toBe(false)

    // Simulate status change
    await act(async () => {
      mockStore.setState((state) => ({
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

  it('integrates correctly with a React component', async () => {
    // Set loading state
    mockStore.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

    function TestComponent() {
      const {
        wallets,
        activeWallet,
        activeWalletAccounts,
        activeWalletAddresses,
        activeAccount,
        activeAddress,
        isReady,
        algodClient
      } = useWallet()
      const { activeNetwork } = useNetwork()

      if (!isReady) {
        return <div data-testid="loading">Loading...</div>
      }

      return (
        <div>
          <ul>
            {wallets.map((wallet) => (
              <li key={wallet.id}>{wallet.metadata.name}</li>
            ))}
          </ul>
          <div data-testid="is-ready">Is Ready: {JSON.stringify(isReady)}</div>
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
          <div data-testid="algod-client">Algod Client: {JSON.stringify(!!algodClient)}</div>
        </div>
      )
    }

    const { getByTestId, getAllByRole } = render(
      <WalletProvider manager={mockWalletManager}>
        <TestComponent />
      </WalletProvider>
    )

    // Verify loading state
    expect(getByTestId('loading')).toHaveTextContent('Loading...')

    // Set ready state
    await act(async () => {
      mockStore.setState((state) => ({
        ...state,
        managerStatus: 'ready'
      }))
    })

    // Verify ready state
    expect(getByTestId('is-ready')).toHaveTextContent('true')

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
    expect(getByTestId('algod-client')).toHaveTextContent('true')

    // Mock a state change in the store
    await act(async () => {
      mockStore.setState((state) => ({
        ...state,
        managerStatus: 'ready',
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

    expect(getByTestId('is-ready')).toHaveTextContent('true')
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
    expect(getByTestId('algod-client')).toHaveTextContent('true')
  })
})
