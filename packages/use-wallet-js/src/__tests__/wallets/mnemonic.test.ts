/* eslint-disable @typescript-eslint/no-unused-vars */
import { Store } from '@tanstack/store'
import * as msgpack from 'algo-msgpack-with-bigint'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { MnemonicWallet } from 'src/wallets/mnemonic'
import { WalletId } from 'src/wallets/types'

const ACCOUNT_MNEMONIC =
  'sugar bronze century excuse animal jacket what rail biology symbol want craft annual soul increase question army win execute slim girl chief exhaust abstract wink'
const TEST_ADDRESS = '3F3FPW6ZQQYD6JDC7FKKQHNGVVUIBIZOUI5WPSJEHBRABZDRN6LOTBMFEY'

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

describe('MnemonicWallet', () => {
  let wallet: MnemonicWallet
  let store: Store<State>
  let mockInitialState: State | null = null

  const mockSubscribe: (callback: (state: State) => void) => () => void = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (callback: (state: State) => void) => {
      return () => console.log('unsubscribe')
    }
  )

  beforeEach(() => {
    vi.clearAllMocks()

    // Mnemonic prompt
    global.prompt = vi.fn().mockReturnValue(ACCOUNT_MNEMONIC)

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
    wallet = new MnemonicWallet({
      id: WalletId.MNEMONIC,
      metadata: {},
      getAlgodClient: {} as any,
      store,
      subscribe: mockSubscribe
    })
  })

  afterEach(async () => {
    global.prompt = vi.fn()
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return account objects, and update store', async () => {
      const account1 = {
        name: 'Mnemonic Account',
        address: TEST_ADDRESS
      }

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1])
      expect(store.state.wallets[WalletId.MNEMONIC]).toEqual({
        accounts: [account1],
        activeAccount: account1
      })
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeDefined()

      await wallet.disconnect()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MNEMONIC]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    describe('when the client is not initialized', () => {
      it('should throw an error', async () => {
        await expect(wallet.signTransactions([])).rejects.toThrowError(
          '[MnemonicWallet] Client not initialized!'
        )
      })
    })
  })

  describe('signTransactions', () => {
    const txn1 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
      amount: 1000,
      flatFee: true
    })

    const txn2 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 2000,
      flatFee: true
    })

    const txn3 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 3000,
      flatFee: true
    })

    const txn4 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 4000,
      flatFee: true
    })

    const { sk } = algosdk.mnemonicToSecretKey(ACCOUNT_MNEMONIC)

    it('should correctly process and sign a single algosdk.Transaction', async () => {
      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1])

      const expectedSignedTxn = txn1.signTxn(sk)

      expect(signedTxnResult).toEqual([expectedSignedTxn])
    })

    it('should correctly process and sign a single algosdk.Transaction group', async () => {
      algosdk.assignGroupID([txn1, txn2])

      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1, txn2])

      const expectedTxnGroup = [txn1, txn2].map((txn) => txn.signTxn(sk))

      expect(signedTxnResult).toEqual(expectedTxnGroup)
    })

    it('should determine which transactions to sign based on indexesToSign', async () => {
      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1, txn2, txn3, txn4], [0, 2])

      const expectedSignedTxn1 = txn1.signTxn(sk)

      const expectedSignedTxn3 = txn3.signTxn(sk)

      const expectedTxnGroup = [
        expectedSignedTxn1,
        algosdk.encodeUnsignedTransaction(txn2),
        expectedSignedTxn3,
        algosdk.encodeUnsignedTransaction(txn4)
      ]

      expect(signedTxnResult).toEqual(expectedTxnGroup)
    })

    it('should determine which transactions to sign based on indexesToSign and return only signed transactions', async () => {
      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1, txn2, txn3, txn4], [0, 2], false)

      const expectedSignedTxn1 = txn1.signTxn(sk)

      const expectedSignedTxn3 = txn3.signTxn(sk)

      const expectedTxnGroup = [expectedSignedTxn1, expectedSignedTxn3]

      expect(signedTxnResult).toEqual(expectedTxnGroup)
    })

    it('should correctly process and sign a single encoded algosdk.Transaction', async () => {
      await wallet.connect()

      const encodedTxn1 = algosdk.encodeUnsignedTransaction(txn1)

      const signedTxnResult = await wallet.signTransactions([encodedTxn1])

      const expectedSignedTxn = txn1.signTxn(sk)

      expect(signedTxnResult).toEqual([expectedSignedTxn])
    })

    it('should correctly process and sign a single encoded algosdk.Transaction group', async () => {
      await wallet.connect()

      const encodedTxn1 = algosdk.encodeUnsignedTransaction(txn1)
      const encodedTxn2 = algosdk.encodeUnsignedTransaction(txn2)

      const signedTxnResult = await wallet.signTransactions([encodedTxn1, encodedTxn2])

      const exceptedSignedTxnGroup = [txn1.signTxn(sk), txn2.signTxn(sk)]

      expect(signedTxnResult).toEqual(exceptedSignedTxnGroup)
    })
  })

  describe('transactionSigner', () => {
    const txn1 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
      amount: 1000,
      flatFee: true
    })

    const txn2 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 2000,
      flatFee: true
    })

    const txn3 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 3000,
      flatFee: true
    })

    const txn4 = new algosdk.Transaction({
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
      genesisID: 'testnet-v1.0',
      from: TEST_ADDRESS,
      to: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4',
      amount: 4000,
      flatFee: true
    })

    const { sk } = algosdk.mnemonicToSecretKey(ACCOUNT_MNEMONIC)

    it('should correctly process and sign a single algosdk.Transaction', async () => {
      await wallet.connect()

      const signedTxnResult = await wallet.transactionSigner([txn1], [0])

      const expectedSignedTxn = txn1.signTxn(sk)

      expect(signedTxnResult).toEqual([expectedSignedTxn])
    })

    it('should correctly process and sign a single algosdk.Transaction group', async () => {
      algosdk.assignGroupID([txn1, txn2])

      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1, txn2], [0, 1])

      const expectedTxnGroup = [txn1, txn2].map((txn) => txn.signTxn(sk))

      expect(signedTxnResult).toEqual(expectedTxnGroup)
    })

    it('should determine which transactions to sign based on indexesToSign', async () => {
      await wallet.connect()

      const signedTxnResult = await wallet.signTransactions([txn1, txn2, txn3, txn4], [0, 2])

      const expectedSignedTxn1 = txn1.signTxn(sk)

      const expectedSignedTxn3 = txn3.signTxn(sk)

      const expectedTxnGroup = [
        expectedSignedTxn1,
        algosdk.encodeUnsignedTransaction(txn2),
        expectedSignedTxn3,
        algosdk.encodeUnsignedTransaction(txn4)
      ]

      expect(signedTxnResult).toEqual(expectedTxnGroup)
    })
  })
})
