import {
  ARC0027MethodCanceledError,
  ARC0027MethodEnum,
  IARC0001Transaction,
  IDisableResult,
  IEnableResult,
  ISignTransactionsResult
} from '@agoralabs-sh/avm-web-provider'
import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { DEFAULT_STATE, LOCAL_STORAGE_KEY, State } from 'src/store'
import { WalletId } from 'src/wallets'
import { DeflyWebWallet, DEFLY_WEB_PROVIDER_ID } from 'src/wallets/defly-web'
import { base64ToByteArray, byteArrayToBase64 } from 'src/utils'
import type { Mock, MockInstance } from 'vitest'

// Test utility type to expose protected members
type TestableDeflyWebWallet = DeflyWebWallet & {
  _signTransactions: (txns: IARC0001Transaction[]) => Promise<ISignTransactionsResult>
  _enable: () => Promise<IEnableResult>
  _disable: () => Promise<IDisableResult>
}

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

// Constants
const TESTNET_GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
const TESTNET_GENESIS_ID = 'testnet-v1.0'
const ACCOUNT_1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
const ACCOUNT_2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

/**
 * Convenience function that initializes a wallet from a supplied store.
 * @param {Store<State>} store - a store to initialize the wallet with.
 * @returns {DeflyWebWallet} an initialized wallet.
 */
function createWalletWithStore(store: Store<State>): DeflyWebWallet {
  return new DeflyWebWallet({
    id: WalletId.DEFLY_WEB,
    metadata: {},
    getAlgodClient: () =>
      ({
        versionsCheck: () => ({
          do: () => Promise.resolve({ genesis_hash_b64: TESTNET_GENESIS_HASH })
        })
      }) as any,
    store,
    subscribe: vi.fn()
  })
}

function mockSignTransactionsResponseOnce(
  stxns: (string | null)[]
): MockInstance<(txns: IARC0001Transaction[]) => Promise<ISignTransactionsResult>> {
  return vi
    .spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_signTransactions')
    .mockReset()
    .mockImplementationOnce(() =>
      Promise.resolve({
        providerId: DEFLY_WEB_PROVIDER_ID,
        stxns
      })
    )
}

describe('DeflyWebWallet', () => {
  let wallet: DeflyWebWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'Defly Web Account 1',
    address: ACCOUNT_1
  }
  const account2 = {
    name: 'Defly Web Account 2',
    address: ACCOUNT_2
  }

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

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
    vi.mocked(logger.createScopedLogger).mockReturnValue(mockLogger)

    vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_disable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: DEFLY_WEB_PROVIDER_ID
        })
      )
    vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_enable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          accounts: [account1, account2],
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: DEFLY_WEB_PROVIDER_ID
        })
      )

    store = new Store<State>(DEFAULT_STATE)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      // Connect wallet
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)

      // Accounts returned
      expect(accounts).toEqual([account1, account2])

      // Store updated
      expect(store.state.wallets[WalletId.DEFLY_WEB]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should handle errors gracefully', async () => {
      const error = new ARC0027MethodCanceledError({
        message: `user dismissed action`,
        method: ARC0027MethodEnum.Enable,
        providerId: DEFLY_WEB_PROVIDER_ID
      })

      // Mock error response
      vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_enable')
        .mockReset()
        .mockImplementationOnce(() => Promise.reject(error))

      // Connect wallet (should fail)
      await expect(wallet.connect()).rejects.toThrow(`user dismissed action`)

      // Wallet is not connected
      expect(wallet.isConnected).toBe(false)

      // Error message logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error connecting: `,
        `${error.message} (code: ${error.code})`
      )

      // Store not updated
      expect(store.state.wallets[WalletId.DEFLY_WEB]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      // Connect wallet
      await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.DEFLY_WEB]).toBeDefined()

      // Disconnect wallet
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.DEFLY_WEB]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
    })

    it(`should call the client's _enable method if Defly Web wallet data is found in the store`, async () => {
      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.DEFLY_WEB]: {
            accounts: [account1],
            activeAccount: account1
          }
        }
      })
      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(wallet['_enable']).toHaveBeenCalled()
    })

    it(`should not call the client's _enable method if Defly Web wallet data is not found in the store`, async () => {
      // No wallets in store
      store = new Store<State>(DEFAULT_STATE)
      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(wallet['_enable']).not.toHaveBeenCalled()
    })

    it('should update the store if accounts returned by the client do not match', async () => {
      // Store contains 'account1' and 'account2', with 'account1' as active
      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.DEFLY_WEB]: {
            accounts: [account1, account2],
            activeAccount: account1
          }
        }
      })
      wallet = createWalletWithStore(store)

      // Client only returns 'account2' on reconnect, 'account1' is missing
      vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_enable')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            accounts: [account2],
            genesisHash: TESTNET_GENESIS_HASH,
            genesisId: TESTNET_GENESIS_ID,
            providerId: DEFLY_WEB_PROVIDER_ID
          })
        )

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(wallet['_enable']).toHaveBeenCalled()
      // Store now only contains 'mockAddress2', which is set as active
      expect(store.state.wallets[WalletId.DEFLY_WEB]).toEqual({
        accounts: [account2],
        activeAccount: account2
      })
    })
  })

  describe('signing transactions', () => {
    const makePayTxn = ({ amount = 1000, sender = ACCOUNT_1, receiver = ACCOUNT_2 }) => {
      return new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'mainnet-v1.0'
        },
        paymentParams: { receiver, amount }
      })
    }

    // Transactions used in tests
    const txn1 = makePayTxn({ amount: 1000 })
    const txn2 = makePayTxn({ amount: 2000 })
    const txn3 = makePayTxn({ amount: 3000 })
    const txn4 = makePayTxn({ amount: 4000 })

    // Mock signed transactions (base64 strings) returned by Kibisis
    const mockSignedTxns = [byteArrayToBase64(txn1.toByte())]

    beforeEach(async () => {
      vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_signTransactions')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            providerId: DEFLY_WEB_PROVIDER_ID,
            stxns: mockSignedTxns
          })
        )

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should call _signTransactions with correct arguments', async () => {
        // Sign transaction
        await wallet.signTransactions([txn1])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should log errors and re-throw to the consuming application', async () => {
        const error = new ARC0027MethodCanceledError({
          message: `user dismissed action`,
          method: ARC0027MethodEnum.SignTransactions,
          providerId: DEFLY_WEB_PROVIDER_ID
        })

        // Mock signTxns error response
        vi.spyOn(DeflyWebWallet.prototype as TestableDeflyWebWallet, '_signTransactions')
          .mockReset()
          .mockImplementationOnce(() => Promise.reject(error))

        try {
          // Signing transaction should fail
          await expect(wallet.signTransactions([txn1])).rejects.toThrowError()
        } catch (error: any) {
          expect(error).toEqual(error)

          // Error message logged
          expect(console.error).toHaveBeenCalledWith(
            `[${DeflyWebWallet.defaultMetadata.name}] error signing transactions: ${error.message} (code: ${error.code})`
          )
        }
      })

      it('should correctly process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should correctly process and sign a multiple algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1) },
          { txn: byteArrayToBase64(gtxn2) },
          { txn: byteArrayToBase64(gtxn3) }
        ])
      })

      it('should correctly process and sign multiple encoded transaction groups', async () => {
        const txnGroup1 = algosdk.assignGroupID([txn1, txn2])
        const [g1txn1, g1txn2] = txnGroup1.map((txn) => txn.toByte())

        const txnGroup2 = algosdk.assignGroupID([txn3, txn4])
        const [g2txn1, g2txn2] = txnGroup2.map((txn) => txn.toByte())

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(g1txn1) },
          { txn: byteArrayToBase64(g1txn2) },
          { txn: byteArrayToBase64(g2txn1) },
          { txn: byteArrayToBase64(g2txn2) }
        ])
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const [gtxn1, gtxn2, gtxn3, gtxn4] = algosdk.assignGroupID([txn1, txn2, txn3, txn4])
        const txnGroup = [gtxn1, gtxn2, gtxn3, gtxn4]
        const indexesToSign = [0, 1, 3]

        const gtxn1String = byteArrayToBase64(gtxn1.toByte())
        const gtxn2String = byteArrayToBase64(gtxn2.toByte())
        const gtxn4String = byteArrayToBase64(gtxn4.toByte())

        mockSignTransactionsResponseOnce([gtxn1String, gtxn2String, null, gtxn4String])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          base64ToByteArray(gtxn1String),
          base64ToByteArray(gtxn2String),
          null,
          base64ToByteArray(gtxn4String)
        ])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn4.toByte()) }
        ])
      })

      it('should only send transactions with connected signers for signature', async () => {
        // Not connected account
        const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

        const canSignTxn1 = makePayTxn({ sender: ACCOUNT_1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: ACCOUNT_2, amount: 3000 })

        // Signer for gtxn2 is not a connected account
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2, // Should not be signed
          canSignTxn3
        ])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
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
    })
  })
})
