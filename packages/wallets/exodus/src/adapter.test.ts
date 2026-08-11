import algosdk from 'algosdk'
import { ExodusAdapter } from './adapter'
import type { Exodus } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import { byteArrayToBase64, base64ToByteArray } from '@txnlab/use-wallet/adapter'
import type { AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

const mockEnableFn = vi.fn()
const mockSignTxns = vi.fn()

const mockExodus: Exodus = {
  isConnected: true,
  address: 'mockAddress1',
  enable: mockEnableFn,
  signTxns: mockSignTxns
}

Object.defineProperty(global, 'window', {
  value: {
    algorand: mockExodus
  }
})

const WALLET_ID = 'exodus'

function createWallet(store: AdapterStoreAccessor): ExodusAdapter {
  return new ExodusAdapter({
    id: WALLET_ID,
    metadata: ExodusAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any
  })
}

describe('ExodusAdapter', () => {
  let wallet: ExodusAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  const account1 = {
    name: 'Exodus Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'Exodus Account 2',
    address: 'mockAddress2'
  }

  beforeEach(() => {
    vi.clearAllMocks()

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
      mockEnableFn.mockResolvedValueOnce({
        genesisID: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        accounts: [account1.address, account2.address]
      })

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if an empty array is returned', async () => {
      mockEnableFn.mockResolvedValueOnce({
        genesisID: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        accounts: []
      })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if connection fails', async () => {
      // @ts-expect-error defined using Object.defineProperty
      window.algorand = undefined

      await expect(wallet.connect()).rejects.toThrow('Exodus is not available.')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)

      // @ts-expect-error defined using Object.defineProperty
      window.algorand = mockExodus
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockEnableFn.mockResolvedValueOnce({
        genesisID: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        accounts: [account1.address]
      })

      await wallet.connect()
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

    it('should resume session if session is found', async () => {
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
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
    })

    it('should throw an error and disconnect if isConnected is false', async () => {
      // @ts-expect-error defined using Object.defineProperty
      window.algorand.isConnected = false

      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      await expect(wallet.resumeSession()).rejects.toThrow('Exodus is not connected.')

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()

      // @ts-expect-error defined using Object.defineProperty
      window.algorand.isConnected = true
    })
  })

  describe('signing transactions', () => {
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
    const connectedAcct2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
    const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

    const makePayTxn = ({ amount = 1000, sender = connectedAcct1, receiver = connectedAcct2 }) => {
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

    const txn1 = makePayTxn({ amount: 1000 })
    const txn2 = makePayTxn({ amount: 2000 })
    const txn3 = makePayTxn({ amount: 3000 })
    const txn4 = makePayTxn({ amount: 4000 })

    beforeEach(async () => {
      mockEnableFn.mockResolvedValueOnce({
        genesisID: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        accounts: [connectedAcct1, connectedAcct2]
      })

      const mockSignedTxn = byteArrayToBase64(txn1.toByte())
      mockSignTxns.mockResolvedValue([mockSignedTxn])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should correctly process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockSignTxns).toHaveBeenCalledWith([{ txn: byteArrayToBase64(txn1.toByte()) }])
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockSignTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
      })

      it('should correctly process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockSignTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(g1txn1.toByte()) },
          { txn: byteArrayToBase64(g1txn2.toByte()) },
          { txn: byteArrayToBase64(g2txn1.toByte()) },
          { txn: byteArrayToBase64(g2txn2.toByte()) }
        ])
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockSignTxns).toHaveBeenCalledWith([{ txn: byteArrayToBase64(txn1.toByte()) }])
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockSignTxns).toHaveBeenCalledWith([
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

        expect(mockSignTxns).toHaveBeenCalledWith([
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

        mockSignTxns.mockResolvedValueOnce([gtxn1String, gtxn2String, null, gtxn4String])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          base64ToByteArray(gtxn1String),
          base64ToByteArray(gtxn2String),
          null,
          base64ToByteArray(gtxn4String)
        ])

        expect(mockSignTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn4.toByte()) }
        ])
      })

      it('should only send transactions with connected signers for signature', async () => {
        const canSignTxn1 = makePayTxn({ sender: connectedAcct1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: connectedAcct2, amount: 3000 })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
          canSignTxn3
        ])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockSignTxns).toHaveBeenCalledWith([
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
