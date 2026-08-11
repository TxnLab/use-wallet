import {
  ARC0027MethodCanceledError,
  ARC0027MethodEnum,
  type IARC0001Transaction,
  type IDisableResult,
  type IEnableResult,
  type ISignTransactionsResult
} from '@agoralabs-sh/avm-web-provider'
import algosdk from 'algosdk'
import { KibisisAdapter } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import { base64ToByteArray, byteArrayToBase64 } from '@txnlab/use-wallet/adapter'
import type { AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'
import type { MockInstance } from 'vitest'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

// Test utility type to expose protected members
type TestableKibisisAdapter = KibisisAdapter & {
  _signTransactions: (txns: IARC0001Transaction[]) => Promise<ISignTransactionsResult>
  _enable: () => Promise<IEnableResult>
  _disable: () => Promise<IDisableResult>
}

const WALLET_ID = 'kibisis'
const KIBISIS_PROVIDER_ID = 'f6d1c86b-4493-42fb-b88d-a62407b4cdf6'

// Constants
const TESTNET_GENESIS_HASH = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='
const TESTNET_GENESIS_ID = 'testnet-v1.0'
const ACCOUNT_1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
const ACCOUNT_2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

function createWallet(store: AdapterStoreAccessor): KibisisAdapter {
  const wallet = new KibisisAdapter({
    id: WALLET_ID,
    metadata: KibisisAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () =>
      ({
        versionsCheck: () => ({
          do: () => Promise.resolve({ genesis_hash_b64: TESTNET_GENESIS_HASH })
        })
      }) as any
  })

  return wallet
}

function mockSignTransactionsResponseOnce(
  stxns: (string | null)[]
): MockInstance<(txns: IARC0001Transaction[]) => Promise<ISignTransactionsResult>> {
  return vi
    .spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_signTransactions')
    .mockReset()
    .mockImplementationOnce(() =>
      Promise.resolve({
        providerId: KIBISIS_PROVIDER_ID,
        stxns
      })
    )
}

describe('KibisisAdapter', () => {
  let wallet: KibisisAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  const account1 = {
    name: 'Kibisis Account 1',
    address: ACCOUNT_1
  }
  const account2 = {
    name: 'Kibisis Account 2',
    address: ACCOUNT_2
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_disable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: KIBISIS_PROVIDER_ID
        })
      )
    vi.spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_enable')
      .mockReset()
      .mockImplementation(() =>
        Promise.resolve({
          accounts: [account1, account2],
          genesisHash: TESTNET_GENESIS_HASH,
          genesisId: TESTNET_GENESIS_ID,
          providerId: KIBISIS_PROVIDER_ID
        })
      )

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor

    wallet = createWallet(accessor)
  })

  afterEach(async () => {
    await wallet.disconnect()
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should handle errors gracefully', async () => {
      const error = new ARC0027MethodCanceledError({
        message: 'user dismissed action',
        method: ARC0027MethodEnum.Enable,
        providerId: KIBISIS_PROVIDER_ID
      })

      vi.spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_enable')
        .mockReset()
        .mockImplementationOnce(() => Promise.reject(error))

      await expect(wallet.connect()).rejects.toThrow('user dismissed action')
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WALLET_ID]).toBeDefined()

      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
    })

    it('should call _enable if wallet data is found in the store', async () => {
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

      expect(wallet.isConnected).toBe(true)
      expect(wallet['_enable']).toHaveBeenCalled()
    })

    it('should not call _enable if wallet data is not found in the store', async () => {
      const harness = createTestHarness(WALLET_ID)
      store = harness.store
      wallet = createWallet(harness.accessor)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(wallet['_enable']).not.toHaveBeenCalled()
    })

    it('should update the store if accounts returned by the client do not match', async () => {
      const walletState: WalletState = {
        accounts: [account1, account2],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      // Client only returns account2 on reconnect, account1 is missing
      vi.spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_enable')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            accounts: [account2],
            genesisHash: TESTNET_GENESIS_HASH,
            genesisId: TESTNET_GENESIS_ID,
            providerId: KIBISIS_PROVIDER_ID
          })
        )

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(wallet['_enable']).toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toEqual({
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

    // Mock signed transactions (base64 strings) returned by provider
    const mockSignedTxns = [byteArrayToBase64(txn1.toByte())]

    beforeEach(async () => {
      vi.spyOn(KibisisAdapter.prototype as TestableKibisisAdapter, '_signTransactions')
        .mockReset()
        .mockImplementation(() =>
          Promise.resolve({
            providerId: KIBISIS_PROVIDER_ID,
            stxns: mockSignedTxns
          })
        )

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should call _signTransactions with correct arguments', async () => {
        await wallet.signTransactions([txn1])

        expect(wallet['_signTransactions']).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
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
        const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

        const canSignTxn1 = makePayTxn({ sender: ACCOUNT_1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: ACCOUNT_2, amount: 3000 })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
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
