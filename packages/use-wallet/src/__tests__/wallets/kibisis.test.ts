// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  ARC0027MethodCanceledError,
  ARC0027MethodEnum,
  IDisableResult,
  IEnableResult,
  ISignTransactionsResult
} from '@agoralabs-sh/avm-web-provider'
import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import * as msgpack from 'algo-msgpack-with-bigint'
import { StorageAdapter } from 'src/storage'
import { defaultState, LOCAL_STORAGE_KEY, State } from 'src/store'
import { WalletId } from 'src/wallets'
import { KibisisWallet, KIBISIS_AVM_WEB_PROVIDER_ID } from 'src/wallets/kibisis'
import { expect } from 'vitest'

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
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

// Constants
const TESTNET_GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
const TESTNET_GENESIS_ID = 'testnet-v1.0'
const ACCOUNT_1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
const ACCOUNT_2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

/**
 * Convenience function that initializes a wallet from a supplied store.
 * @param {Store<State>} store - a store to initialize the wallet with.
 * @returns {KibisisWallet} an initialized wallet.
 */
function createWalletWithStore(store: Store<State>): KibisisWallet {
  return new KibisisWallet({
    id: WalletId.KIBISIS,
    metadata: {},
    getAlgodClient: () =>
      ({
        versionsCheck: () => ({
          do: () => Promise.resolve({ genesis_hash_b64: TESTNET_GENESIS_HASH })
        })
      }) as any,
    store,
    subscribe: vi.fn(() => {
      return () => console.log('unsubscribe')
    })
  })
}

function mockSignTransactionsResponseOnce(stxns: (string | null)[]): void {
  vi.spyOn(KibisisWallet.prototype, '_signTransactions')
    .mockReset()
    .mockImplementationOnce(() =>
      Promise.resolve({
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        stxns
      } as ISignTransactionsResult)
    )
}

describe('KibisisWallet', () => {
  const account1 = {
    name: 'Kibisis Wallet 1',
    address: ACCOUNT_1
  }
  const account2 = {
    name: 'Kibisis Wallet 2',
    address: ACCOUNT_2
  }
  let wallet: KibisisWallet
  let store: Store<State>
  let mockInitialState: State | null = null

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
    vi.spyOn(KibisisWallet.prototype, '_disable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID
        } as IDisableResult)
      )
    vi.spyOn(KibisisWallet.prototype, '_enable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          accounts: [account1, account2],
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID
        } as IEnableResult)
      )

    store = new Store<State>(defaultState)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return account objects, and update store', async () => {
      // Connect wallet
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)

      // Accounts returned
      expect(accounts).toEqual([account1, account2])

      // Store updated
      expect(store.state.wallets[WalletId.KIBISIS]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should handle errors gracefully', async () => {
      const error = new ARC0027MethodCanceledError({
        message: `user dismissed action`,
        method: ARC0027MethodEnum.Enable,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID
      })

      // Mock error response
      vi.spyOn(KibisisWallet.prototype, '_enable')
        .mockReset()
        .mockImplementationOnce(() => Promise.reject(error))

      // Connect wallet (should fail)
      const accounts = await wallet.connect()

      // Wallet is not connected
      expect(wallet.isConnected).toBe(false)

      // Error message logged
      expect(console.error).toHaveBeenCalledWith(
        `[${KibisisWallet.defaultMetadata.name}] error connecting: ${error.message} (code: ${error.code})`
      )

      // No accounts returned
      expect(accounts).toEqual([])

      // Store not updated
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      // Connect wallet
      await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.KIBISIS]).toBeDefined()

      // Disconnect wallet
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it(`should call the client's _enable method if Kibisis wallet data is found in the store`, async () => {
      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.KIBISIS]: {
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

    it(`should not call the client's _enable method if Kibisis wallet data is not found in the store`, async () => {
      // No wallets in store
      store = new Store<State>(defaultState)
      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(wallet['_enable']).not.toHaveBeenCalled()
    })

    it('should update the store if accounts returned by the client do not match', async () => {
      // Store contains 'account1' and 'account2', with 'account1' as active
      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.KIBISIS]: {
            accounts: [account1, account2],
            activeAccount: account1
          }
        }
      })
      wallet = createWalletWithStore(store)

      // Client only returns 'account2' on reconnect, 'account1' is missing
      vi.spyOn(KibisisWallet.prototype, '_enable')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            accounts: [account2],
            genesisHash: TESTNET_GENESIS_HASH,
            genesisId: TESTNET_GENESIS_ID,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID
          })
        )

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(wallet['_enable']).toHaveBeenCalled()
      // Store now only contains 'mockAddress2', which is set as active
      expect(store.state.wallets[WalletId.KIBISIS]).toEqual({
        accounts: [account2],
        activeAccount: account2
      })
    })
  })

  describe('signTransactions', () => {
    const txnParams = {
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: TESTNET_GENESIS_HASH,
      genesisID: 'testnet-v1.0'
    }

    // Transactions used in tests
    const txn1 = new algosdk.Transaction({
      ...txnParams,
      from: ACCOUNT_1,
      to: ACCOUNT_1,
      amount: 1000
    })
    const txn2 = new algosdk.Transaction({
      ...txnParams,
      from: ACCOUNT_1,
      to: ACCOUNT_1,
      amount: 2000
    })

    // Signed transactions
    const signedTxn1 = {
      txn: Buffer.from(txn1.toByte()).toString('base64'),
      sig: 'mockBase64Signature'
    }
    const signedTxn2 = {
      txn: Buffer.from(txn2.toByte()).toString('base64'),
      sig: 'mockBase64Signature'
    }

    // Signed transactions (base64 strings) returned by Kibisis
    const signedTxnStr1 = Buffer.from(
      new Uint8Array(msgpack.encode(signedTxn1, { sortKeys: true }))
    ).toString('base64')
    const signedTxnStr2 = Buffer.from(
      new Uint8Array(msgpack.encode(signedTxn2, { sortKeys: true }))
    ).toString('base64')

    // Signed transactions (Uint8Array) returned by use-wallet
    const signedTxnEncoded1 = new Uint8Array(Buffer.from(signedTxnStr1, 'base64'))
    const signedTxnEncoded2 = new Uint8Array(Buffer.from(signedTxnStr2, 'base64'))

    beforeEach(async () => {
      vi.spyOn(KibisisWallet.prototype, '_signTransactions')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
            stxns: [signedTxnStr1]
          } as ISignTransactionsResult)
        )

      await wallet.connect()
    })

    it('should call _signTransactions with correct arguments', async () => {
      // Sign transaction
      await wallet.signTransactions([txn1])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        }
      ])
    })

    it('should log errors and re-throw to the consuming application', async () => {
      const error = new ARC0027MethodCanceledError({
        message: `user dismissed action`,
        method: ARC0027MethodEnum.SignTransactions,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID
      })

      // Mock signTxns error response
      vi.spyOn(KibisisWallet.prototype, '_signTransactions')
        .mockReset()
        .mockImplementationOnce(() => Promise.reject(error))

      try {
        // Signing transaction should fail
        await expect(wallet.signTransactions([txn1])).rejects.toThrowError()
      } catch (error: any) {
        expect(error).toEqual(error)

        // Error message logged
        expect(console.error).toHaveBeenCalledWith(
          `[${KibisisWallet.defaultMetadata.name}] error signing transactions: ${error.message} (code: ${error.code})`
        )
      }
    })

    it('should correctly process and sign a single algosdk.Transaction', async () => {
      mockSignTransactionsResponseOnce([signedTxnStr1])

      const result = await wallet.signTransactions([txn1])

      expect(result).toEqual([signedTxnEncoded1])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign a multiple algosdk.Transaction group', async () => {
      mockSignTransactionsResponseOnce([signedTxnStr1, signedTxnStr2])

      const result = await wallet.signTransactions([txn1, txn2])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        },
        {
          txn: Buffer.from(txn2.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign a single encoded transaction', async () => {
      mockSignTransactionsResponseOnce([signedTxnStr1])

      const encodedTxn = txn1.toByte()
      const result = await wallet.signTransactions([encodedTxn])

      expect(result).toEqual([signedTxnEncoded1])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign a single encoded transaction group', async () => {
      mockSignTransactionsResponseOnce([signedTxnStr1, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

      const result = await wallet.signTransactions(encodedTxnGroup)

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        },
        {
          txn: Buffer.from(txn2.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign multiple encoded transaction groups', async () => {
      mockSignTransactionsResponseOnce([signedTxnStr1, signedTxnStr2])

      const result = await wallet.signTransactions([[txn1.toByte()], [txn2.toByte()]])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        },
        {
          txn: Buffer.from(txn2.toByte()).toString('base64')
        }
      ])
    })

    it('should determine which transactions to sign based on indexesToSign', async () => {
      mockSignTransactionsResponseOnce([null, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const indexesToSign = [1] // Only sign txn2
      const returnGroup = false // Return only the signed transaction

      const expectedResult = [signedTxnEncoded2]

      const result = await wallet.signTransactions(txnGroup, indexesToSign, returnGroup)

      expect(result).toEqual(expectedResult)

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64'),
          signers: [] // txn1 should not be signed
        },
        {
          txn: Buffer.from(txn2.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly merge signed transactions back into the original group', async () => {
      mockSignTransactionsResponseOnce([null, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const returnGroup = true // Merge signed transaction back into original group

      // Only txn2 should be signed
      const indexesToSign1 = [1]
      const expectedResult1 = [algosdk.encodeUnsignedTransaction(txn1), signedTxnEncoded2]

      const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
      expect(result1).toEqual(expectedResult1)

      mockSignTransactionsResponseOnce([signedTxnStr1, null])

      // Only txn1 should be signed
      const indexesToSign2 = [0]
      const expectedResult2 = [signedTxnEncoded1, algosdk.encodeUnsignedTransaction(txn2)]

      const result2 = await wallet.signTransactions(txnGroup, indexesToSign2, returnGroup)
      expect(result2).toEqual(expectedResult2)
    })

    it('should only send transactions with connected signers for signature', async () => {
      const txnCannotSign = new algosdk.Transaction({
        ...txnParams,
        from: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4', // EW64GC is not connected
        to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        amount: 3000
      })

      mockSignTransactionsResponseOnce([signedTxnStr1, null, signedTxnStr2])

      const result = await wallet.signTransactions([txn1, txnCannotSign, txn2])

      // expectedResult[1] should be original unsigned transaction
      const expectedResult = [
        signedTxnEncoded1,
        algosdk.encodeUnsignedTransaction(txnCannotSign),
        signedTxnEncoded2
      ]

      expect(result).toEqual(expectedResult)

      expect(wallet['_signTransactions']).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        },
        {
          txn: Buffer.from(txnCannotSign.toByte()).toString('base64'),
          signers: [] // txnCannotSign should not be signed
        },
        {
          txn: Buffer.from(txn2.toByte()).toString('base64')
        }
      ])
    })
  })
})
