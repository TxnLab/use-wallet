import algosdk from 'algosdk'
import { MnemonicAdapter, LOCAL_STORAGE_MNEMONIC_KEY } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import type { AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

const ACCOUNT_MNEMONIC =
  'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'
const TEST_ADDRESS = '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'

const WALLET_ID = 'mnemonic'

// localStorage mock
let localStorageData: Record<string, string> = {}

const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageData[key]
  }),
  clear: vi.fn(() => {
    localStorageData = {}
  }),
  get length() {
    return Object.keys(localStorageData).length
  },
  key: vi.fn((index: number) => Object.keys(localStorageData)[index] ?? null)
}

function createWallet(
  store: AdapterStoreAccessor,
  options?: {
    persistToStorage?: boolean
    promptForMnemonic?: () => Promise<string | null>
  }
): MnemonicAdapter {
  return new MnemonicAdapter({
    id: WALLET_ID,
    metadata: MnemonicAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any,
    options
  })
}

describe('MnemonicAdapter', () => {
  let wallet: MnemonicAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  const account1 = {
    name: 'Mnemonic Account',
    address: TEST_ADDRESS
  }

  const setActiveNetwork = (networkId: string) => {
    store.setState((state) => ({
      ...state,
      activeNetwork: networkId
    }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageData = {}

    vi.stubGlobal('localStorage', mockLocalStorage)

    // Mnemonic prompt
    global.prompt = vi.fn().mockReturnValue(ACCOUNT_MNEMONIC)

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor

    wallet = createWallet(accessor)
  })

  afterEach(async () => {
    global.prompt = vi.fn()
    await wallet.disconnect()
    vi.unstubAllGlobals()
  })

  describe('connect', () => {
    it('should initialize client, return account, and update store', async () => {
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1],
        activeAccount: account1
      })
    })

    it('should load mnemonic from localStorage', async () => {
      localStorageData[LOCAL_STORAGE_MNEMONIC_KEY] = ACCOUNT_MNEMONIC

      await wallet.connect()

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_MNEMONIC_KEY)
      expect(wallet.isConnected).toBe(true)
    })

    it('should save mnemonic into localStorage if not in storage and persistToStorage is enabled', async () => {
      wallet = createWallet(accessor, { persistToStorage: true })

      await wallet.connect()

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_MNEMONIC_KEY,
        ACCOUNT_MNEMONIC
      )
    })

    it('should throw an error if active network is MainNet', async () => {
      setActiveNetwork('mainnet')

      await expect(wallet.connect()).rejects.toThrow('Production network detected. Aborting.')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client, remove mnemonic from localStorage, and remove wallet from store', async () => {
      await wallet.connect()
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(LOCAL_STORAGE_MNEMONIC_KEY)
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
    })

    it('should disconnect if session is found and persistToStorage is disabled', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })

    it('should resume session if session is found and persistToStorage is enabled', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      localStorageData[LOCAL_STORAGE_MNEMONIC_KEY] = ACCOUNT_MNEMONIC

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor, { persistToStorage: true })

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
    })

    it('should disconnect if resuming the session failed and persistToStorage is enabled', async () => {
      // No mnemonic in storage, empty prompt
      global.prompt = vi.fn().mockReturnValue('')

      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor, { persistToStorage: true })

      await expect(wallet.resumeSession()).rejects.toThrow('No mnemonic provided')

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })

    it('should throw an error if active network is MainNet', async () => {
      setActiveNetwork('mainnet')

      await expect(wallet.resumeSession()).rejects.toThrow('Production network detected. Aborting.')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
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
        expect(store.state.wallets[WALLET_ID]).toBeUndefined()
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
        expect(store.state.wallets[WALLET_ID]).toBeUndefined()
        expect(wallet.isConnected).toBe(false)
      })
    })
  })

  describe('custom prompt for mnemonic', () => {
    const MOCK_ACCOUNT_MNEMONIC =
      'just aim reveal time update elegant column reunion lazy ritual room unusual notice camera forward couple quantum gym laundry absurd drill pyramid tip able outdoor'

    beforeEach(() => {
      wallet = createWallet(accessor, {
        promptForMnemonic: () => Promise.resolve(MOCK_ACCOUNT_MNEMONIC),
        persistToStorage: true
      })
    })

    it('should save mnemonic into localStorage', async () => {
      await wallet.connect()

      expect(global.prompt).toHaveBeenCalledTimes(0)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_MNEMONIC_KEY,
        MOCK_ACCOUNT_MNEMONIC
      )
    })
  })

  describe('withPrivateKey', () => {
    const { sk: expectedSk } = algosdk.mnemonicToSecretKey(ACCOUNT_MNEMONIC)

    beforeEach(async () => {
      await wallet.connect()
    })

    it('should provide 64-byte Algorand secret key to callback', async () => {
      const result = await wallet.withPrivateKey(async (secretKey) => {
        expect(secretKey).toBeInstanceOf(Uint8Array)
        expect(secretKey.length).toBe(64)
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    it('should provide a copy with correct key values', async () => {
      await wallet.withPrivateKey(async (secretKey) => {
        expect(Array.from(secretKey)).toEqual(Array.from(expectedSk))
      })
    })

    it('should provide a copy, not the original key', async () => {
      await wallet.withPrivateKey(async (secretKey) => {
        secretKey.fill(0)
      })

      // Wallet should still be able to sign (original key intact)
      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: TEST_ADDRESS,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: TEST_ADDRESS, amount: 1000 }
      })
      const result = await wallet.signTransactions([txn])
      expect(result.length).toBe(1)
    })

    it('should zero the key copy after callback completes', async () => {
      let capturedKey: Uint8Array | null = null

      await wallet.withPrivateKey(async (secretKey) => {
        capturedKey = secretKey
        expect(secretKey.some((byte) => byte !== 0)).toBe(true)
      })

      expect(capturedKey!.every((byte) => byte === 0)).toBe(true)
    })

    it('should zero the key copy even if callback throws', async () => {
      let capturedKey: Uint8Array | null = null

      await expect(
        wallet.withPrivateKey(async (secretKey) => {
          capturedKey = secretKey
          throw new Error('Callback error')
        })
      ).rejects.toThrow('Callback error')

      expect(capturedKey!.every((byte) => byte === 0)).toBe(true)
    })

    it('should throw if wallet is not connected', async () => {
      await wallet.disconnect()

      await expect(wallet.withPrivateKey(async () => {})).rejects.toThrow(
        'Mnemonic wallet not connected'
      )
    })

    it('should throw if active network is MainNet', async () => {
      setActiveNetwork('mainnet')

      await expect(wallet.withPrivateKey(async () => {})).rejects.toThrow(
        'Production network detected. Aborting.'
      )
    })

    it('should report canUsePrivateKey as true', () => {
      expect(wallet.canUsePrivateKey).toBe(true)
    })
  })
})
