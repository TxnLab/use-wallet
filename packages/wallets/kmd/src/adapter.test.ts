import algosdk from 'algosdk'
import { KmdAdapter } from './adapter'
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

const mockKmd = {
  listWallets: vi.fn(),
  initWalletHandle: vi.fn(),
  listKeys: vi.fn(),
  releaseWalletHandle: vi.fn(),
  signTransaction: vi.fn()
}

vi.mock('algosdk', async (importOriginal) => {
  const module = await importOriginal<typeof import('algosdk')>()
  return {
    ...module,
    default: {
      ...module,
      Kmd: vi.fn(() => mockKmd)
    }
  }
})

const WALLET_ID = 'kmd'

const mockWallet = { id: 'mockId', name: 'unencrypted-default-wallet' }
const mockPassword = 'password'
const mockToken = 'token'

function createWallet(
  store: AdapterStoreAccessor,
  options?: { promptForPassword?: () => Promise<string>; wallet?: string }
): KmdAdapter {
  const wallet = new KmdAdapter({
    id: WALLET_ID,
    metadata: KmdAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any,
    options
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockKmd

  return wallet
}

describe('KmdAdapter', () => {
  let wallet: KmdAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  const account1 = {
    name: 'KMD Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'KMD Account 2',
    address: 'mockAddress2'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor

    wallet = createWallet(accessor)

    // Password prompt
    global.prompt = vi.fn().mockReturnValue(mockPassword)

    mockKmd.listWallets.mockResolvedValue({ wallets: [mockWallet] })
    mockKmd.initWalletHandle.mockResolvedValue({ wallet_handle_token: mockToken })
  })

  afterEach(async () => {
    global.prompt = vi.fn()
    await wallet.disconnect()
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [account1.address, account2.address] })

      const accounts = await wallet.connect()

      expect(mockKmd.listWallets).toHaveBeenCalled()
      expect(mockKmd.initWalletHandle).toHaveBeenCalledWith(mockWallet.id, mockPassword)
      expect(mockKmd.listKeys).toHaveBeenCalledWith(mockToken)

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if initWalletHandle fails', async () => {
      mockKmd.initWalletHandle.mockRejectedValueOnce(new Error('Fetch token error'))

      await expect(wallet.connect()).rejects.toThrow('Fetch token error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if listKeys fails', async () => {
      mockKmd.listKeys.mockRejectedValueOnce(new Error('Fetch accounts error'))

      await expect(wallet.connect()).rejects.toThrow('Fetch accounts error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [] })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: ['mockAddress'] })

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
      mockKmd.listKeys.mockResolvedValueOnce({
        addresses: [connectedAcct1, connectedAcct2]
      })

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should correctly process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockKmd.signTransaction).toHaveBeenCalledWith(mockToken, mockPassword, txn1)
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(3)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(1, mockToken, mockPassword, gtxn1)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(2, mockToken, mockPassword, gtxn2)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(3, mockToken, mockPassword, gtxn3)
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(4)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(1, mockToken, mockPassword, g1txn1)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(2, mockToken, mockPassword, g1txn2)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(3, mockToken, mockPassword, g2txn1)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(4, mockToken, mockPassword, g2txn2)
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockKmd.signTransaction).toHaveBeenCalledWith(
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(encodedTxn)
        )
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(3)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          1,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(gtxn1)
        )
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          2,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(gtxn2)
        )
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          3,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(gtxn3)
        )
      })

      it('should process and sign multiple encoded transaction groups', async () => {
        const txnGroup1 = algosdk.assignGroupID([txn1, txn2])
        const [g1txn1, g1txn2] = txnGroup1.map((txn) => txn.toByte())

        const txnGroup2 = algosdk.assignGroupID([txn3, txn4])
        const [g2txn1, g2txn2] = txnGroup2.map((txn) => txn.toByte())

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(4)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          1,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(g1txn1)
        )
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          2,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(g1txn2)
        )
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          3,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(g2txn1)
        )
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(
          4,
          mockToken,
          mockPassword,
          algosdk.decodeUnsignedTransaction(g2txn2)
        )
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const [gtxn1, gtxn2, gtxn3, gtxn4] = algosdk.assignGroupID([txn1, txn2, txn3, txn4])
        const indexesToSign = [0, 1, 3]

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3, gtxn4], indexesToSign)

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(indexesToSign.length)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(1, mockToken, mockPassword, gtxn1)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(2, mockToken, mockPassword, gtxn2)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(3, mockToken, mockPassword, gtxn4)
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

        expect(mockKmd.signTransaction).toHaveBeenCalledTimes(2)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(1, mockToken, mockPassword, gtxn1)
        expect(mockKmd.signTransaction).toHaveBeenNthCalledWith(2, mockToken, mockPassword, gtxn3)
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

  describe('getPassword', () => {
    it('should return empty string password when set', async () => {
      global.prompt = vi.fn().mockReturnValue('')

      // Recreate wallet so it picks up the new prompt
      wallet = createWallet(accessor)

      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [account1.address] })
      await wallet.connect()

      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [account1.address] })
      await wallet.connect()

      // Prompt should only be called once (password is cached)
      expect(global.prompt).toHaveBeenCalledTimes(1)
      expect(mockKmd.initWalletHandle).toHaveBeenCalledWith(mockWallet.id, '')
    })

    it('should handle null from cancelled prompt', async () => {
      global.prompt = vi.fn().mockReturnValue(null)

      wallet = createWallet(accessor)

      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [account1.address] })
      await wallet.connect()

      expect(global.prompt).toHaveBeenCalledTimes(1)
      expect(mockKmd.initWalletHandle).toHaveBeenCalledWith(mockWallet.id, '')
    })
  })

  describe('custom prompt for password', () => {
    const customPassword = 'customPassword'

    beforeEach(() => {
      wallet = createWallet(accessor, {
        promptForPassword: () => Promise.resolve(customPassword)
      })
    })

    it('should return password from custom prompt', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [account1.address] })
      await wallet.connect()

      expect(global.prompt).toHaveBeenCalledTimes(0)
      expect(mockKmd.initWalletHandle).toHaveBeenCalledWith(mockWallet.id, customPassword)
    })
  })
})
