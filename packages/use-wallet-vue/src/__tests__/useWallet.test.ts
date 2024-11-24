/* eslint-disable no-extra-semi */
import { Store } from '@tanstack/vue-store'
import {
  BaseWallet,
  DeflyWallet,
  MagicAuth,
  NetworkId,
  WalletManager,
  WalletId,
  DEFAULT_NETWORKS,
  DEFAULT_STATE,
  type State,
  type WalletAccount
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { inject, nextTick, ref, type InjectionKey } from 'vue'
import { useWallet, type Wallet } from '../useWallet'
import type { Mock } from 'vitest'

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

let mockWalletManager: WalletManager

vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn((token: string | InjectionKey<unknown>) => {
      if (token === 'walletManager') return mockWalletManager
      if (token === 'setAlgodClient') return mockSetAlgodClient
      if (token === 'algodClient') return ref(mockAlgodClient)
      return null
    })
  }
})

const mockStore = new Store<State>(DEFAULT_STATE)

const mockDeflyWallet = new DeflyWallet({
  id: WalletId.DEFLY,
  metadata: { name: 'Defly', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn(),
  networks: DEFAULT_NETWORKS
})

const mockMagicAuth = new MagicAuth({
  id: WalletId.MAGIC,
  options: {
    apiKey: 'api-key'
  },
  metadata: { name: 'Magic', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: vi.fn(),
  networks: DEFAULT_NETWORKS
})

const mockAlgodClient = ref(new algosdk.Algodv2('token', 'https://server', ''))

const mockSetAlgodClient = (client: algosdk.Algodv2) => {
  mockAlgodClient.value = client
}

describe('useWallet', () => {
  let mockWallets: Wallet[]

  const mockInjectImplementation = (token: string | InjectionKey<unknown>) => {
    if (token === 'walletManager') return mockWalletManager
    if (token === 'setAlgodClient') return mockSetAlgodClient
    if (token === 'algodClient') return mockAlgodClient
    return null
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore.setState(() => DEFAULT_STATE)

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
    ;(inject as Mock).mockImplementation(mockInjectImplementation)
  })

  it('throws an error if WalletManager is not installed', () => {
    ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
      if (token === 'walletManager') return null
      if (token === 'setAlgodClient') return null
      if (token === 'algodClient') return null
      return null
    })
    expect(() => useWallet()).toThrow('WalletManager plugin is not properly installed')
  })

  it('initializes wallets and active wallet correctly', () => {
    const { wallets, activeWallet, activeAccount, activeNetwork } = useWallet()

    expect(wallets.value).toEqual(mockWallets)
    expect(activeWallet.value).toBeNull()
    expect(activeAccount.value).toBeNull()
    expect(activeNetwork.value).toBe(NetworkId.TESTNET)
  })

  it('correctly handles wallet connect/disconnect', async () => {
    const { wallets } = useWallet()

    const defly = wallets.value[0]
    const magic = wallets.value[1]

    // Simulate connect and disconnect for Defly (no args)
    await defly.connect()
    await defly.disconnect()

    expect(mocks.connect).toHaveBeenCalledWith(undefined)
    expect(mocks.disconnect).toHaveBeenCalled()

    // Simulate connect and disconnect for Magic (with email)
    await magic.connect({ email: 'test@example.com' })
    await magic.disconnect()

    expect(mocks.connect).toHaveBeenCalledWith({ email: 'test@example.com' })
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls setActive and setActiveAccount correctly', () => {
    const { wallets } = useWallet()

    // Simulate setActive
    wallets.value[0].setActive()
    wallets.value[0].setActiveAccount('address')

    expect(mocks.setActive).toHaveBeenCalled()
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('address')
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    const { signTransactions, transactionSigner } = useWallet()

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

    // Simulate signTransactions and transactionSigner
    await signTransactions([], [])
    await transactionSigner([], [])

    expect(mocks.signTransactions).toHaveBeenCalledWith([], [])
    expect(mocks.transactionSigner).toHaveBeenCalledWith([], [])
  })

  it('updates wallets when store state changes', () => {
    const { wallets } = useWallet()

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

    expect(wallets.value).toEqual([
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

  it('reactively updates the algodClient', async () => {
    const { algodClient, setAlgodClient } = useWallet()

    const newAlgodClient = new algosdk.Algodv2('mock-token', 'https://mock-server', '')

    setAlgodClient(newAlgodClient)

    await nextTick()

    expect(algodClient.value).toStrictEqual(newAlgodClient)
  })

  it('updates algodClient when setActiveNetwork is called', async () => {
    const { setActiveNetwork, algodClient } = useWallet()

    const newNetwork = NetworkId.MAINNET

    // Default mainnet algod config
    const newAlgodClient = new algosdk.Algodv2('', 'https://mainnet-api.4160.nodely.dev/', '')

    mockWalletManager.setActiveNetwork = async (networkId: string) => {
      mockSetAlgodClient(newAlgodClient)
      mockWalletManager.store.setState((state) => ({
        ...state,
        activeNetwork: networkId,
        algodClient: newAlgodClient
      }))
    }

    setActiveNetwork(newNetwork)

    await nextTick()

    expect(algodClient.value).toStrictEqual(newAlgodClient)
  })

  it('integrates correctly with Vue component', async () => {
    const { wallets, activeWallet, activeAddress, activeNetwork } = useWallet()

    const TestComponent = {
      template: `
        <div>
          <ul>
            <li v-for="wallet in wallets" :key="wallet.id" data-testid="wallet">
              {{ wallet.metadata.name }}
            </li>
          </ul>
          <div data-testid="activeNetwork">{{ activeNetwork }}</div>
          <div data-testid="activeWallet">{{ activeWallet?.id }}</div>
          <div data-testid="activeAddress">{{ activeAddress }}</div>
        </div>
      `,
      setup() {
        return {
          wallets,
          activeWallet,
          activeAddress,
          activeNetwork
        }
      }
    }

    const wrapper = mount(TestComponent)

    const listItems = wrapper.findAll('[data-testid="wallet"]')
    expect(listItems).toHaveLength(2)

    mockWallets.forEach((wallet, index) => {
      expect(listItems[index].text()).toBe(wallet.metadata.name)
    })

    expect(activeNetwork.value).toBe(NetworkId.TESTNET)
    expect(activeWallet.value).toBeNull()
    expect(activeAddress.value).toBeNull()

    expect(wrapper.get('[data-testid="activeNetwork"]').text()).toBe(NetworkId.TESTNET)
    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe('')
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('')

    // Mock a state change in the store
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

    // Force a re-render of the component
    await nextTick(() => {
      wrapper.vm.$forceUpdate()
    })

    expect(activeWallet.value?.id).toBe(WalletId.DEFLY)
    expect(activeAddress.value).toBe('address1')

    expect(wrapper.get('[data-testid="activeNetwork"]').text()).toBe(NetworkId.TESTNET)
    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe(WalletId.DEFLY)
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('address1')
  })
})
