import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { base64ToByteArray, byteArrayToBase64 } from 'src/utils'
import { MagicAuth } from 'src/wallets/magic'
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

const mockMagicClient = {
  auth: {
    loginWithMagicLink: vi.fn()
  },
  user: {
    getInfo: vi.fn(),
    logout: vi.fn(),
    isLoggedIn: vi.fn()
  },
  algorand: {
    signGroupTransactionV2: vi.fn()
  }
}

vi.mock('magic-sdk', () => {
  return {
    Magic: vi.fn(() => mockMagicClient)
  }
})

function createWalletWithStore(store: Store<State>): MagicAuth {
  return new MagicAuth({
    id: WalletId.MAGIC,
    options: {
      apiKey: 'mock-api-key'
    },
    metadata: {},
    getAlgodClient: {} as any,
    store,
    subscribe: vi.fn()
  })
}

describe('MagicAuth', () => {
  let wallet: MagicAuth
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const email = 'test@example.com'
  const publicAddress = 'mockAddress'

  const account = {
    name: email,
    address: publicAddress
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

    store = new Store<State>(defaultState)
    wallet = createWalletWithStore(store)

    mockMagicClient.auth.loginWithMagicLink.mockImplementation(() => Promise.resolve())
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, auth, return account, and update store', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })

      const result = await wallet.connect({ email })

      expect(mockMagicClient.auth.loginWithMagicLink).toHaveBeenCalledWith({ email })
      expect(wallet.isConnected).toBe(true)
      expect(result).toEqual([account])
      expect(store.state.wallets[WalletId.MAGIC]).toEqual({
        accounts: [account],
        activeAccount: account
      })
    })

    it('should throw an error if email is missing', async () => {
      await expect(wallet.connect()).rejects.toThrow(
        'Magic Link provider requires an email (string) to connect'
      )
    })

    it('should throw an error if loginWithMagicLink fails', async () => {
      mockMagicClient.auth.loginWithMagicLink.mockRejectedValueOnce(new Error('Auth error'))
      await expect(wallet.connect({ email })).rejects.toThrow('Auth error')
    })

    it('should throw an error if getInfo fails', async () => {
      mockMagicClient.user.getInfo.mockRejectedValueOnce(new Error('Get info error'))
      await expect(wallet.connect({ email })).rejects.toThrow('Get info error')
    })

    it('should throw an error if user info does not contain an address', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce(undefined)
      await expect(wallet.connect({ email })).rejects.toThrow('User info not found!')
    })

    it('should throw an error if user info does not contain an address', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email })
      await expect(wallet.connect({ email })).rejects.toThrow('No account found!')
    })
  })

  describe('disconnect', () => {
    it('should log out user and update store', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })

      await wallet.connect({ email })
      await wallet.disconnect()

      expect(mockMagicClient.user.logout).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MAGIC]).toBeUndefined()
    })

    it('should throw an error if client.user.logout fails', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })
      mockMagicClient.user.logout.mockRejectedValueOnce(new Error('Logout error'))

      await wallet.connect({ email })
      await expect(wallet.disconnect()).rejects.toThrow('Logout error')

      // Should still update store/state
      expect(store.state.wallets[WalletId.MAGIC]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(mockMagicClient.user.getInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
    })

    it('should disconnect if user is not logged in', async () => {
      const walletState: WalletState = {
        accounts: [
          {
            name: email,
            address: publicAddress
          }
        ],
        activeAccount: {
          name: email,
          address: publicAddress
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(false)
      await wallet.resumeSession()

      expect(mockMagicClient.user.isLoggedIn).toHaveBeenCalled()
      expect(mockMagicClient.user.getInfo).not.toHaveBeenCalled()

      expect(store.state.wallets[WalletId.MAGIC]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should resume session if session is found', async () => {
      const walletState: WalletState = {
        accounts: [
          {
            name: email,
            address: publicAddress
          }
        ],
        activeAccount: {
          name: email,
          address: publicAddress
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(true)
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })

      await wallet.resumeSession()

      expect(mockMagicClient.user.isLoggedIn).toHaveBeenCalled()
      expect(mockMagicClient.user.getInfo).toHaveBeenCalled()

      expect(store.state.wallets[WalletId.MAGIC]).toEqual(walletState)
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if accounts do not match', async () => {
      const prevAccount = {
        name: 'foo@example.com',
        address: 'mockAddress1'
      }

      const newAccount = {
        name: 'bar@example.com',
        address: 'mockAddress2'
      }

      const walletState: WalletState = {
        accounts: [prevAccount],
        activeAccount: prevAccount
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(true)
      mockMagicClient.user.getInfo.mockResolvedValueOnce({
        email: newAccount.name,
        publicAddress: newAccount.address
      })
      await wallet.resumeSession()

      expect(mockLogger.warn).toHaveBeenCalledWith('Session account mismatch, updating account', {
        prev: prevAccount,
        current: newAccount
      })

      expect(store.state.wallets[WalletId.MAGIC]).toEqual({
        accounts: [newAccount],
        activeAccount: newAccount
      })
    })
  })

  describe('signing transactions', () => {
    // Connected accounts
    const connectedAcct = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'

    // Not connected account
    const notConnectedAcct = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

    const txnParams = {
      from: connectedAcct,
      to: connectedAcct,
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
      mockMagicClient.user.getInfo.mockResolvedValueOnce({
        email,
        publicAddress: connectedAcct
      })

      const mockSignedTxn = byteArrayToBase64(txn1.toByte())
      mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValue([mockSignedTxn])

      await wallet.connect({ email })
    })

    describe('signTransactions', () => {
      it('should correctly process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
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

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(g1txn1.toByte()) },
          { txn: byteArrayToBase64(g1txn2.toByte()) },
          { txn: byteArrayToBase64(g2txn1.toByte()) },
          { txn: byteArrayToBase64(g2txn2.toByte()) }
        ])
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
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

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
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

        // Mock signGroupTransactionV2 to return "signed" (not really) base64 transactions or undefined
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          gtxn1String,
          gtxn2String,
          undefined,
          gtxn4String
        ])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          base64ToByteArray(gtxn1String),
          base64ToByteArray(gtxn2String),
          null,
          base64ToByteArray(gtxn4String)
        ])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn4.toByte()) }
        ])
      })

      it('should only send transactions with connected signers for signature', async () => {
        const canSignTxn1 = new algosdk.Transaction({
          ...txnParams,
          from: connectedAcct,
          amount: 1000
        })

        const cannotSignTxn2 = new algosdk.Transaction({
          ...txnParams,
          from: notConnectedAcct,
          amount: 2000
        })

        const canSignTxn3 = new algosdk.Transaction({
          ...txnParams,
          from: connectedAcct,
          amount: 3000
        })

        // Signer for gtxn2 is not a connected account
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2, // Should not be signed
          canSignTxn3
        ])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
      })
    })
  })
})
