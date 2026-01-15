/* eslint-disable no-extra-semi */
import { Store } from '@tanstack/vue-store'
import {
  BaseWallet,
  DeflyWallet,
  MagicAuth,
  NetworkId,
  WalletManager,
  WalletId,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_STATE,
  type State,
  type WalletAccount
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { inject, nextTick, ref, type InjectionKey } from 'vue'
import { useWallet, type Wallet } from '../useWallet'
import type { Mock } from 'vitest'

// Mock Vue's inject function
vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn()
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

let mockStore: Store<State>
let mockWalletManager: WalletManager
let mockDeflyWallet: DeflyWallet
let mockMagicAuth: MagicAuth
const mockAlgodClient = ref(new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''))

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
    wallets: [WalletId.DEFLY]
  })

  vi.spyOn(mockWalletManager, 'store', 'get').mockReturnValue(mockStore)

  // Create mock wallets after store is initialized
  mockDeflyWallet = new DeflyWallet({
    id: WalletId.DEFLY,
    metadata: { name: 'Defly', icon: 'icon' },
    getAlgodClient: () => ({}) as any,
    store: mockStore,
    subscribe: vi.fn()
  })

  mockMagicAuth = new MagicAuth({
    id: WalletId.MAGIC,
    options: {
      apiKey: 'api-key'
    },
    metadata: { name: 'Magic', icon: 'icon' },
    getAlgodClient: () => ({}) as any,
    store: mockStore,
    subscribe: vi.fn()
  })
  ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
    if (token === 'walletManager') return mockWalletManager
    if (token === 'algodClient') return mockAlgodClient
    return null
  })
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
    wallets: {}
  }))
})

describe('useWallet', () => {
  let mockWallets: Wallet[]

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
    const { wallets, activeWallet, activeAccount } = useWallet()

    expect(wallets.value).toEqual(mockWallets)
    expect(activeWallet.value).toBeNull()
    expect(activeAccount.value).toBeNull()
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

  it('integrates correctly with Vue component', async () => {
    const { wallets, activeWallet, activeAddress, isReady } = useWallet()

    const TestComponent = {
      template: `
        <div>
          <div data-testid="is-ready">{{ isReady }}</div>
          <ul>
            <li v-for="wallet in wallets" :key="wallet.id" data-testid="wallet">
              {{ wallet.metadata.name }}
            </li>
          </ul>
          <div data-testid="activeWallet">{{ activeWallet?.id }}</div>
          <div data-testid="activeAddress">{{ activeAddress }}</div>
        </div>
      `,
      setup() {
        return {
          wallets,
          activeWallet,
          activeAddress,
          isReady
        }
      }
    }

    const wrapper = mount(TestComponent)

    const listItems = wrapper.findAll('[data-testid="wallet"]')
    expect(listItems).toHaveLength(2)

    mockWallets.forEach((wallet, index) => {
      expect(listItems[index].text()).toBe(wallet.metadata.name)
    })

    expect(activeWallet.value).toBeNull()
    expect(activeAddress.value).toBeNull()

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

    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe(WalletId.DEFLY)
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('address1')
  })

  it('initializes with isReady false and updates when manager status changes', async () => {
    const { isReady } = useWallet()

    // Initially should not be ready
    expect(isReady.value).toBe(false)

    mockStore.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    await nextTick()

    expect(isReady.value).toBe(true)

    // Change back to initializing (though this shouldn't happen in practice)
    mockStore.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

    await nextTick()

    expect(isReady.value).toBe(false)
  })

  it('integrates isReady with Vue component', async () => {
    const TestComponent = {
      template: `
        <div>
          <div data-testid="is-ready">{{ isReady }}</div>
        </div>
      `,
      setup() {
        const { isReady } = useWallet()
        return { isReady }
      }
    }

    const wrapper = mount(TestComponent)

    // Initially not ready
    expect(wrapper.get('[data-testid="is-ready"]').text()).toBe('false')

    mockStore.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    await nextTick()

    // Should show ready after status change
    expect(wrapper.get('[data-testid="is-ready"]').text()).toBe('true')
  })
})
