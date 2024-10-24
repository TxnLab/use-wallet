import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { KmdWallet } from 'src/wallets/kmd'
import { WalletId } from 'src/wallets/types'
import type { Mock } from 'vitest'

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

function createWalletWithStore(store: Store<State>): KmdWallet {
  return new KmdWallet({
    id: WalletId.KMD,
    metadata: {},
    getAlgodClient: {} as any,
    store,
    subscribe: vi.fn()
  })
}

describe('KmdWallet', () => {
  let wallet: KmdWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'KMD Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'KMD Account 2',
    address: 'mockAddress2'
  }

  const mockWallet = { id: 'mockId', name: 'unencrypted-default-wallet' }
  const mockPassword = 'password'
  const mockToken = 'token'

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

    store = new Store<State>(defaultState)
    wallet = createWalletWithStore(store)

    // Password prompt
    global.prompt = vi.fn().mockReturnValue(mockPassword)

    mockKmd.listWallets.mockResolvedValue({ wallets: [mockWallet] })
    mockKmd.initWalletHandle.mockResolvedValue({ wallet_handle_token: mockToken })
  })

  afterEach(async () => {
    global.prompt = vi.fn()
    await wallet.disconnect()
    mockInitialState = null
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
      expect(store.state.wallets[WalletId.KMD]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if initWalletHandle fails', async () => {
      mockKmd.initWalletHandle.mockRejectedValueOnce(new Error('Fetch token error'))

      await expect(wallet.connect()).rejects.toThrow('Fetch token error')
      expect(store.state.wallets[WalletId.KMD]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if listKeys fails', async () => {
      mockKmd.listKeys.mockRejectedValueOnce(new Error('Fetch accounts error'))

      await expect(wallet.connect()).rejects.toThrow('Fetch accounts error')
      expect(store.state.wallets[WalletId.KMD]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: [] })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.KMD]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockKmd.listKeys.mockResolvedValueOnce({ addresses: ['mockAddress'] })

      await wallet.connect()
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.KMD]).toBeUndefined()
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
        ...defaultState,
        wallets: {
          [WalletId.KMD]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.KMD]).toEqual(walletState)
    })
  })

  describe('signing transactions', () => {
    // Connected accounts
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
    const connectedAcct2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

    // Not connected account
    const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

    const txnParams = {
      from: connectedAcct1,
      to: connectedAcct2,
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
      genesisID: 'mainnet-v1.0'
    }

    // Transactions used in tests
    const txn1 = new algosdk.Transaction({ ...txnParams, amount: 1000 })
    const txn2 = new algosdk.Transaction({ ...txnParams, amount: 2000 })
    const txn3 = new algosdk.Transaction({ ...txnParams, amount: 3000 })
    const txn4 = new algosdk.Transaction({ ...txnParams, amount: 4000 })

    beforeEach(async () => {
      // Mock two connected accounts
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
        const canSignTxn1 = new algosdk.Transaction({
          ...txnParams,
          from: connectedAcct1,
          amount: 1000
        })

        const cannotSignTxn2 = new algosdk.Transaction({
          ...txnParams,
          from: notConnectedAcct,
          amount: 2000
        })

        const canSignTxn3 = new algosdk.Transaction({
          ...txnParams,
          from: connectedAcct2,
          amount: 3000
        })

        // Signer for gtxn2 is not a connected account
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2, // Should not be signed
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
})
