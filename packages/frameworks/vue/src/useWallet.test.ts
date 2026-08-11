import {
  BaseWallet,
  WalletManager,
  type WalletAccount,
  type WalletAdapterConfig,
  type AdapterConstructorParams
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import algosdk from 'algosdk'
import { inject, nextTick, ref, type InjectionKey } from 'vue'
import { useWallet } from './useWallet'
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

let mockWalletManager: WalletManager
const mockAlgodClient = ref(new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()

  mockWalletManager = new WalletManager({
    wallets: [mockAdapterA(), mockAdapterB()]
  })
  ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
    if (token === 'walletManager') return mockWalletManager
    if (token === 'algodClient') return mockAlgodClient
    return null
  })
})

describe('useWallet', () => {
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

    expect(wallets.value).toHaveLength(2)
    expect(wallets.value[0].id).toBe('wallet-a')
    expect(wallets.value[1].id).toBe('wallet-b')
    expect(activeWallet.value).toBeNull()
    expect(activeAccount.value).toBeNull()
  })

  it('correctly handles wallet connect/disconnect', async () => {
    const { wallets } = useWallet()

    const walletA = wallets.value[0]

    await walletA.connect()
    await walletA.disconnect()

    expect(mocks.connect).toHaveBeenCalledWith(undefined)
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('calls setActive and setActiveAccount correctly', () => {
    const { wallets } = useWallet()

    wallets.value[0].setActive()
    wallets.value[0].setActiveAccount('address')

    expect(mocks.setActive).toHaveBeenCalled()
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('address')
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    const { signTransactions, transactionSigner } = useWallet()

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

    await signTransactions([], [])
    await transactionSigner([], [])

    expect(mocks.signTransactions).toHaveBeenCalledWith([], [])
    expect(mocks.transactionSigner).toHaveBeenCalledWith([], [])
  })

  it('updates wallets when store state changes', () => {
    const { wallets, activeWallet, activeAddress } = useWallet()

    mockWalletManager.store.setState((state) => ({
      ...state,
      wallets: {
        'wallet-a': {
          accounts: [
            { name: 'Account 1', address: 'address1' },
            { name: 'Account 2', address: 'address2' }
          ],
          activeAccount: { name: 'Account 1', address: 'address1' }
        }
      },
      activeWallet: 'wallet-a'
    }))

    expect(activeWallet.value?.id).toBe('wallet-a')
    expect(activeAddress.value).toBe('address1')
    expect(wallets.value[0].isConnected).toBe(true)
    expect(wallets.value[0].isActive).toBe(true)
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
    expect(listItems[0].text()).toBe('Wallet A')
    expect(listItems[1].text()).toBe('Wallet B')

    expect(activeWallet.value).toBeNull()
    expect(activeAddress.value).toBeNull()

    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe('')
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('')

    // Mock a state change in the store
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

    // Force a re-render of the component
    await nextTick(() => {
      wrapper.vm.$forceUpdate()
    })

    expect(activeWallet.value?.id).toBe('wallet-a')
    expect(activeAddress.value).toBe('address1')

    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe('wallet-a')
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('address1')
  })

  it('initializes with isReady false and updates when manager status changes', async () => {
    // Reset manager status to initializing
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

    const { isReady } = useWallet()

    // Initially should not be ready
    expect(isReady.value).toBe(false)

    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    await nextTick()

    expect(isReady.value).toBe(true)

    // Change back to initializing
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

    await nextTick()

    expect(isReady.value).toBe(false)
  })

  it('integrates isReady with Vue component', async () => {
    // Reset manager status to initializing
    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'initializing'
    }))

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

    mockWalletManager.store.setState((state) => ({
      ...state,
      managerStatus: 'ready'
    }))

    await nextTick()

    // Should show ready after status change
    expect(wrapper.get('[data-testid="is-ready"]').text()).toBe('true')
  })
})

describe('useWallet - availableWallets', () => {
  it('filters wallets by active network capabilities', () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
      if (token === 'walletManager') return manager
      if (token === 'algodClient') return mockAlgodClient
      return null
    })

    const { wallets, availableWallets } = useWallet()

    // testnet: wallet-a (mainnet only) ✗, wallet-b (all) ✓
    expect(wallets.value).toHaveLength(2)
    expect(availableWallets.value).toHaveLength(1)
    expect(availableWallets.value[0].id).toBe('wallet-b')
  })

  it('re-filters when active network changes', async () => {
    const manager = new WalletManager({
      wallets: [mockAdapterMainnetOnly(), mockAdapterB()],
      defaultNetwork: 'testnet'
    })

    ;(inject as Mock).mockImplementation((token: string | InjectionKey<unknown>) => {
      if (token === 'walletManager') return manager
      if (token === 'algodClient') return mockAlgodClient
      return null
    })

    const { availableWallets } = useWallet()

    expect(availableWallets.value).toHaveLength(1)

    await manager.setActiveNetwork('mainnet')
    await nextTick()

    // mainnet: wallet-a ✓, wallet-b ✓
    expect(availableWallets.value).toHaveLength(2)
  })

  it('returns all wallets when none have capabilities', () => {
    const { wallets, availableWallets } = useWallet()

    expect(availableWallets.value).toHaveLength(2)
    expect(wallets.value).toHaveLength(2)
  })
})
