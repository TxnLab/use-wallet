/* eslint-disable @typescript-eslint/no-unused-vars */
import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { DEFAULT_NETWORKS } from 'src/network'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, DEFAULT_STATE } from 'src/store'
import { LOCAL_STORAGE_MNEMONIC_KEY, MnemonicWallet } from 'src/wallets/mnemonic'
import { WalletId } from 'src/wallets/types'
import type { Mock } from 'vitest'

const ACCOUNT_MNEMONIC =
  'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'
const TEST_ADDRESS = '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'

// Mock logger
vi.mock('src/logger', () => ({
  logger: {
    createScopedLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
}))

function createWalletWithStore(store: Store<State>, persistToStorage = false): MnemonicWallet {
  return new MnemonicWallet({
    id: WalletId.MNEMONIC,
    options: { persistToStorage },
    metadata: {},
    getAlgodClient: {} as any,
    store,
    subscribe: vi.fn(),
    networks: DEFAULT_NETWORKS
  })
}

describe('MnemonicWallet', () => {
  let wallet: MnemonicWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'Mnemonic Account',
    address: TEST_ADDRESS
  }

  const setActiveNetwork = (networkId: string) => {
    store.setState((state) => {
      return {
        ...state,
        activeNetwork: networkId
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mnemonic prompt
    global.prompt = vi.fn().mockReturnValue(ACCOUNT_MNEMONIC)

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      if (key === LOCAL_STORAGE_MNEMONIC_KEY) {
        return ACCOUNT_MNEMONIC
      }
      return null
    })

    vi.mocked(StorageAdapter.setItem).mockImplementation((key: string, value: string) => {
      if (key === LOCAL_STORAGE_KEY) {
        mockInitialState = JSON.parse(value)
      }
    })

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    vi.mocked(logger.createScopedLogger).mockReturnValue(mockLogger)

    store = new Store<State>(DEFAULT_STATE)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    global.prompt = vi.fn()
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return account, load mnemonic from storage, and update store', async () => {
      const storageGetItemSpy = vi.spyOn(StorageAdapter, 'getItem')

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1])
      expect(store.state.wallets[WalletId.MNEMONIC]).toEqual({
        accounts: [account1],
        activeAccount: account1
      })
      expect(storageGetItemSpy).toHaveBeenCalledWith(LOCAL_STORAGE_MNEMONIC_KEY)
    })

    it('should save mnemonic into storage if there is no mnemonic in storage and persisting to storage is enabled', async () => {
      const storageSetItemSpy = vi.spyOn(StorageAdapter, 'setItem')
      // Simulate no mnemonic in storage
      vi.mocked(StorageAdapter.getItem).mockImplementation(() => null)
      // Enable persisting to storage
      wallet = createWalletWithStore(store, true)

      await wallet.connect()

      expect(storageSetItemSpy).toHaveBeenCalledWith(LOCAL_STORAGE_MNEMONIC_KEY, ACCOUNT_MNEMONIC)
    })

    it('should throw an error if active network is MainNet', async () => {
      setActiveNetwork('mainnet')

      await expect(wallet.connect()).rejects.toThrow('Production network detected. Aborting.')
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client, remove mnemonic from storage, and remove wallet from store', async () => {
      const storageRemoveItemSpy = vi.spyOn(StorageAdapter, 'removeItem')

      await wallet.connect()
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
      expect(storageRemoveItemSpy).toHaveBeenCalledOnce()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
    })

    it('should disconnect if session is found and persisting to storage is disabled', async () => {
      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.MNEMONIC]: {
            accounts: [account1],
            activeAccount: account1
          }
        }
      })

      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
    })

    it('should resume session if session is found and persisting to storage is enabled', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }
      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.MNEMONIC]: walletState
        }
      })
      // Enable persisting to storage
      wallet = createWalletWithStore(store, true)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.MNEMONIC]).toEqual(walletState)
    })

    it('should disconnect if resuming the session failed and persisting to storage is enabled', async () => {
      // Set up a condition that would make the account (re)initialization fail
      vi.mocked(StorageAdapter.getItem).mockImplementation(() => null) // No mnemonic in storage
      global.prompt = vi.fn().mockReturnValue('') // Nothing entered into the mnemonic prompt

      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.MNEMONIC]: {
            accounts: [account1],
            activeAccount: account1
          }
        }
      })
      // Enable persisting to storage
      wallet = createWalletWithStore(store, true)

      await expect(wallet.resumeSession()).rejects.toThrow('No mnemonic provided')

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
    })

    it('should throw an error if active network is MainNet', async () => {
      setActiveNetwork('mainnet')

      await expect(wallet.resumeSession()).rejects.toThrow('Production network detected. Aborting.')
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('signing transactions', () => {
    const makePayTxn = ({ amount = 1000, sender = TEST_ADDRESS, receiver = TEST_ADDRESS }) => {
      return new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver, amount }
      })
    }

    // Transactions used in tests
    const txn1 = makePayTxn({ amount: 1000 })
    const txn2 = makePayTxn({ amount: 2000 })
    const txn3 = makePayTxn({ amount: 3000 })
    const txn4 = makePayTxn({ amount: 4000 })

    beforeEach(async () => {
      await wallet.connect()
    })

    describe('signTransactions', () => {
      const { sk } = algosdk.mnemonicToSecretKey(ACCOUNT_MNEMONIC)

      it('should correctly process and sign a single algosdk.Transaction', async () => {
        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([txn1.signTxn(sk)])
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const result = await wallet.signTransactions(txnGroup)

        const expected = txnGroup.map((txn) => txn.signTxn(sk))
        expect(result).toEqual(expected)
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const txnGroup1 = algosdk.assignGroupID([txn1, txn2])
        const txnGroup2 = algosdk.assignGroupID([txn3, txn4])

        const result = await wallet.signTransactions([txnGroup1, txnGroup2])

        const expected = [...txnGroup1, ...txnGroup2].map((txn) => txn.signTxn(sk))
        expect(result).toEqual(expected)
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        const result = await wallet.signTransactions([encodedTxn])

        expect(result).toEqual([txn1.signTxn(sk)])
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const encodedGroup = txnGroup.map((txn) => txn.toByte())

        const result = await wallet.signTransactions(encodedGroup)

        const expected = txnGroup.map((txn) => txn.signTxn(sk))
        expect(result).toEqual(expected)
      })

      it('should process and sign multiple encoded transaction groups', async () => {
        const txnGroup1 = algosdk.assignGroupID([txn1, txn2])
        const encodedGroup1 = txnGroup1.map((txn) => txn.toByte())

        const txnGroup2 = algosdk.assignGroupID([txn3, txn4])
        const encodedGroup2 = txnGroup2.map((txn) => txn.toByte())

        const result = await wallet.signTransactions([encodedGroup1, encodedGroup2])

        const expected = [...txnGroup1, ...txnGroup2].map((txn) => txn.signTxn(sk))
        expect(result).toEqual(expected)
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const [gtxn1, gtxn2, gtxn3, gtxn4] = algosdk.assignGroupID([txn1, txn2, txn3, txn4])
        const indexesToSign = [0, 1, 3]

        const result = await wallet.signTransactions([gtxn1, gtxn2, gtxn3, gtxn4], indexesToSign)

        const expected = [gtxn1, gtxn2, gtxn4].map((txn) => txn.signTxn(sk))
        expect(result).toEqual(expected)
      })

      it('should throw an error if active network is MainNet', async () => {
        setActiveNetwork('mainnet')

        await expect(wallet.signTransactions([])).rejects.toThrow(
          'Production network detected. Aborting.'
        )
        expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
        expect(wallet.isConnected).toBe(false)
      })
    })

    describe('transactionSigner', () => {
      it('should call signTransactions with the correct arguments', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const indexesToSign = [1]

        const signTransactionsSpy = vi.spyOn(wallet, 'signTransactions')

        await wallet.transactionSigner(txnGroup, indexesToSign)

        expect(signTransactionsSpy).toHaveBeenCalledWith(txnGroup, indexesToSign)
      })

      it('should throw an error if active network is MainNet', async () => {
        setActiveNetwork('mainnet')

        await expect(wallet.transactionSigner([], [])).rejects.toThrow(
          'Production network detected. Aborting.'
        )
        expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
        expect(wallet.isConnected).toBe(false)
      })
    })
  })

  describe('custom prompt for mnemonic', () => {
    const MOCK_ACCOUNT_MNEMONIC =
      'just aim reveal time update elegant column reunion lazy ritual room unusual notice camera forward couple quantum gym laundry absurd drill pyramid tip able outdoor'

    beforeEach(() => {
      wallet = new MnemonicWallet({
        id: WalletId.MNEMONIC,
        options: {
          promptForMnemonic: () => Promise.resolve(MOCK_ACCOUNT_MNEMONIC),
          persistToStorage: true
        },
        metadata: {},
        getAlgodClient: {} as any,
        store,
        subscribe: vi.fn(),
        networks: DEFAULT_NETWORKS
      })
    })

    it('should save mnemonic into storage', async () => {
      const storageSetItemSpy = vi.spyOn(StorageAdapter, 'setItem')
      // Simulate no mnemonic in storage
      vi.mocked(StorageAdapter.getItem).mockImplementation(() => null)

      await wallet.connect()

      expect(global.prompt).toHaveBeenCalledTimes(0)
      expect(storageSetItemSpy).toHaveBeenCalledWith(
        LOCAL_STORAGE_MNEMONIC_KEY,
        MOCK_ACCOUNT_MNEMONIC
      )
    })
  })
})
