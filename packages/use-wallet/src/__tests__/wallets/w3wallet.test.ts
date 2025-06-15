import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, DEFAULT_STATE } from 'src/store'
import { base64ToByteArray, byteArrayToBase64 } from 'src/utils'
import { W3Wallet, W3WalletProvider } from 'src/wallets/w3wallet'
import { WalletId } from 'src/wallets/types'
import { beforeEach, Mock } from 'vitest'

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

const mockSignTxns = vi.fn()

// Mock W3 Wallet
const mockW3Wallet: W3WalletProvider = {
  isConnected: () => Promise.resolve(true),
  account: () => Promise.resolve({
    address: "mockAddress1",
    name: "W3 Wallet Account 1",
  }),
  signTxns: mockSignTxns
}

Object.defineProperty(global, 'window', {
  value: {
    algorand: mockW3Wallet
  }
})

function createWalletWithStore(store: Store<State>): W3Wallet {
  return new W3Wallet({
    id: WalletId.W3_WALLET,
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn()
  })
}

describe('W3 Wallet', () => {
  let wallet: W3Wallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'W3 Wallet Account 1',
    address: 'mockAddress1'
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

    store = new Store<State>(DEFAULT_STATE)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      // @ts-expect-error defined using Object.defineProperty
      window.algorand.account = () => Promise.resolve({
        address: "mockAddress1",
        name: "W3 Wallet Account 1",
      });
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1])
      expect(store.state.wallets[WalletId.W3_WALLET]).toEqual({
        accounts: [account1],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      // @ts-expect-error defined using Object.defineProperty
      window.algorand = undefined

      await expect(wallet.connect()).rejects.toThrow('W3 Wallet is not available.')
      expect(store.state.wallets[WalletId.W3_WALLET]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)

      // @ts-expect-error defined using Object.defineProperty
      window.algorand = mockW3Wallet
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      await wallet.connect()
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.W3_WALLET]).toBeUndefined()
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

      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.W3_WALLET]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.W3_WALLET]).toEqual(walletState)
    })

    it('should throw an error and disconnect if isConnected is false', async () => {
      // @ts-expect-error defined using Object.defineProperty
      window.algorand.isConnected = () => Promise.resolve(false)

      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.W3_WALLET]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      await expect(wallet.resumeSession()).rejects.toThrow('W3 Wallet is not connected.')

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.W3_WALLET]).toBeUndefined()

      // @ts-expect-error defined using Object.defineProperty
      window.algorand.isConnected = true
    })
  })

  describe('signing transactions', () => {
    // Connected accounts
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
    // Not connected account
    const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

    const makePayTxn = ({ amount = 1000, sender = connectedAcct1, receiver = notConnectedAcct }) => {
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

    beforeEach(async () => {
      const mockSignedTxn = byteArrayToBase64(txn1.toByte())
      mockSignTxns.mockResolvedValue([mockSignedTxn])

      // @ts-expect-error defined using Object.defineProperty
      window.algorand.account = () =>
        Promise.resolve({
          address: connectedAcct1,
          name: 'Connected Account 1'
        })
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

        // Mock signTxns to return "signed" (not really) base64 transactions or null
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

        // Signer for gtxn2 is not a connected account
        const [gtxn1, gtxn2] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2, // Should not be signed
        ])

        await wallet.signTransactions([gtxn1, gtxn2])

        expect(mockSignTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()), signers: [] },
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
