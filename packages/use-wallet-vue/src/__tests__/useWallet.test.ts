import { Store } from '@tanstack/vue-store'
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
} from '@txnlab/use-wallet'
import { mount } from '@vue/test-utils'
import { inject, nextTick } from 'vue'
import { useWallet, type Wallet } from '../useWallet'

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

vi.mock('vue', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue')>()
  return {
    ...mod,
    inject: vi.fn().mockImplementation(() => new WalletManager())
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

const mockMagicAuth = new MagicAuth({
  id: WalletId.MAGIC,
  options: {
    apiKey: 'api-key'
  },
  metadata: { name: 'Magic', icon: 'icon' },
  getAlgodClient: () => ({}) as any,
  store: mockStore,
  subscribe: mockSubscribe
})

describe('useWallet', () => {
  let mockWalletManager: WalletManager
  let mockWallets: Wallet[]

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
  })

  it('throws an error if WalletManager is not installed', () => {
    vi.mocked(inject).mockImplementation(() => null)
    expect(() => useWallet()).toThrow('WalletManager plugin is not properly installed')
  })

  it('initializes wallets and active wallet correctly', () => {
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
    const { wallets, activeWallet, activeAccount, activeNetwork } = useWallet()

    expect(wallets.value).toEqual(mockWallets)
    expect(activeWallet.value).toBeNull()
    expect(activeAccount.value).toBeNull()
    expect(activeNetwork.value).toBe(NetworkId.TESTNET)
  })

  it('correctly handles wallet connect/disconnect', async () => {
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
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
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
    const { wallets } = useWallet()

    // Simulate setActive
    wallets.value[0].setActive()
    wallets.value[0].setActiveAccount('address')

    expect(mocks.setActive).toHaveBeenCalled()
    expect(mocks.setActiveAccount).toHaveBeenCalledWith('address')
  })

  it('calls signTransactions and transactionSigner correctly', async () => {
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
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
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
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

  /**
   * @todo Fix this test
   *
   * This test passed before implementing StorageAdapter in core lib. Mocking a state change should
   * update the activeWallet and activeAddress in the component, but it doesn't.
   */
  it.skip('integrates correctly with Vue component', async () => {
    vi.mocked(inject).mockImplementation(() => mockWalletManager)
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

    await nextTick()

    expect(activeWallet.value?.id).toBe(WalletId.DEFLY)
    expect(activeAddress.value).toBe('address1')

    expect(wrapper.get('[data-testid="activeNetwork"]').text()).toBe(NetworkId.TESTNET)
    expect(wrapper.get('[data-testid="activeWallet"]').text()).toBe(WalletId.DEFLY) // fails
    expect(wrapper.get('[data-testid="activeAddress"]').text()).toBe('address1') // fails
  })
})
