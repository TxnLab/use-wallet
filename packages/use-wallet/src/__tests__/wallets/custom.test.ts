import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { CustomProvider, CustomWallet, WalletId } from 'src/wallets'

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

// Spy/suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

// Mock custom provider
class MockProvider implements CustomProvider {
  constructor() {}
  connect = vi.fn()
  disconnect = vi.fn()
  resumeSession = vi.fn()
  signTransactions = vi.fn()
  transactionSigner = vi.fn()
}

const mockProvider = new MockProvider()

describe('CustomWallet', () => {
  let wallet: CustomWallet
  let store: Store<State>
  let mockInitialState: State | null = null

  const account1 = {
    name: 'Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'Account 2',
    address: 'mockAddress2'
  }

  const mockSubscribe: (callback: (state: State) => void) => () => void = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (callback: (state: State) => void) => {
      return () => console.log('unsubscribe')
    }
  )

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      return null
    })

    vi.mocked(StorageAdapter.setItem).mockImplementation((key: string, value: string) => {
      if (key === LOCAL_STORAGE_KEY) {
        mockInitialState = JSON.parse(value)
      }
    })

    store = new Store<State>(defaultState)
    wallet = new CustomWallet({
      id: WalletId.CUSTOM,
      options: {
        provider: mockProvider
      },
      metadata: {
        name: 'Custom Provider',
        icon: 'mock-icon'
      },
      getAlgodClient: {} as any,
      store,
      subscribe: mockSubscribe
    })
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('constructor', () => {
    it('should throw an error if provider is not defined', () => {
      expect(
        () =>
          new CustomWallet({
            id: WalletId.CUSTOM,
            // @ts-expect-error missing provider
            options: {},
            metadata: {},
            getAlgodClient: {} as any,
            store,
            subscribe: mockSubscribe
          })
      ).toThrowError('[Custom] Missing required option: provider')
    })
  })

  describe('connect', () => {
    it('should return accounts and update store', async () => {
      vi.mocked(mockProvider.connect).mockResolvedValueOnce([account1, account2])

      const accounts = await wallet.connect()

      expect(accounts).toEqual([account1, account2])
      expect(mockProvider.connect).toHaveBeenCalled()
      expect(mockProvider.connect).toHaveBeenCalledWith(undefined)
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.CUSTOM]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if no accounts are found', async () => {
      vi.mocked(mockProvider.connect).mockResolvedValueOnce([])

      await expect(wallet.connect()).rejects.toThrowError('No accounts found!')
      expect(wallet.isConnected).toBe(false)
    })

    it('should re-throw an error if thrown by provider', async () => {
      vi.mocked(mockProvider.connect).mockRejectedValueOnce(new Error('mock error'))

      await expect(wallet.connect()).rejects.toThrowError('mock error')
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should call provider.disconnect and update store', async () => {
      vi.mocked(mockProvider.connect).mockResolvedValueOnce([account1])

      await wallet.connect()
      await wallet.disconnect()

      expect(mockProvider.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.CUSTOM]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(mockProvider.resumeSession).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
    })

    it('should call provider.resumeSession if a session is found', async () => {
      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.CUSTOM]: {
            accounts: [account1],
            activeAccount: account1
          }
        }
      })

      wallet = new CustomWallet({
        id: WalletId.CUSTOM,
        options: {
          provider: mockProvider
        },
        metadata: {
          name: 'Custom Provider',
          icon: 'mock-icon'
        },
        getAlgodClient: {} as any,
        store,
        subscribe: mockSubscribe
      })

      await wallet.resumeSession()

      expect(mockProvider.resumeSession).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if provider.resumeSession returns different account(s)', async () => {
      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.CUSTOM]: {
            accounts: [account1],
            activeAccount: account1
          }
        }
      })

      wallet = new CustomWallet({
        id: WalletId.CUSTOM,
        options: {
          provider: mockProvider
        },
        metadata: {
          name: 'Custom Provider',
          icon: 'mock-icon'
        },
        getAlgodClient: {} as any,
        store,
        subscribe: mockSubscribe
      })

      vi.mocked(mockProvider.resumeSession).mockResolvedValueOnce([account2, account1])

      await wallet.resumeSession()

      expect(store.state.wallets[WalletId.CUSTOM]).toEqual({
        accounts: [account2, account1],
        activeAccount: account1
      })
      expect(wallet.isConnected).toBe(true)
    })
  })

  describe('signTransactions', () => {
    it('should call provider.signTransactions', async () => {
      const txn = new algosdk.Transaction({
        from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        amount: 1000,
        fee: 10,
        firstRound: 51,
        lastRound: 61,
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        genesisID: 'mainnet-v1.0'
      })

      const txnGroup = [txn]
      const indexesToSign = [0]

      await wallet.signTransactions(txnGroup, indexesToSign)

      expect(mockProvider.signTransactions).toHaveBeenCalled()
      expect(mockProvider.signTransactions).toHaveBeenCalledWith(txnGroup, indexesToSign, true)
    })
  })

  describe('transactionSigner', () => {
    it('should call provider.transactionSigner', async () => {
      const txn = new algosdk.Transaction({
        from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        amount: 1000,
        fee: 10,
        firstRound: 51,
        lastRound: 61,
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        genesisID: 'mainnet-v1.0'
      })

      const txnGroup = [txn]
      const indexesToSign = [0]

      await wallet.transactionSigner(txnGroup, indexesToSign)

      expect(mockProvider.transactionSigner).toHaveBeenCalled()
      expect(mockProvider.transactionSigner).toHaveBeenCalledWith(txnGroup, indexesToSign)
    })
  })
})
