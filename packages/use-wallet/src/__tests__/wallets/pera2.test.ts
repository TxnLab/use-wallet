import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { PeraWallet } from 'src/wallets/pera2'
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

const mockPeraWallet = {
  connect: vi.fn(),
  reconnectSession: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  client: {
    on: vi.fn(),
    off: vi.fn()
  }
}

vi.mock('@perawallet/connect-beta', () => {
  return {
    PeraWalletConnect: vi.fn(() => mockPeraWallet)
  }
})

function createWalletWithStore(store: Store<State>): PeraWallet {
  const wallet = new PeraWallet({
    id: WalletId.PERA2,
    options: {
      projectId: 'mockProjectId'
    },
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn()
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockPeraWallet

  return wallet
}

describe('PeraWallet', () => {
  let wallet: PeraWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'Pera Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'Pera Account 2',
    address: 'mockAddress2'
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
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.PERA2]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      mockPeraWallet.connect.mockRejectedValueOnce(new Error('Auth error'))

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockPeraWallet.connect.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should register session_delete event listener after successful connection', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      await wallet.connect()

      expect(mockPeraWallet.client.on).toHaveBeenCalledWith('session_delete', expect.any(Function))
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      await wallet.disconnect()

      expect(mockPeraWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if client.disconnect fails', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address])
      mockPeraWallet.disconnect.mockRejectedValueOnce(new Error('Disconnect error'))

      await wallet.connect()

      await expect(wallet.disconnect()).rejects.toThrow('Disconnect error')

      // Should still update store/state
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('session_delete event', () => {
    it('should handle session_delete event and update store', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])
      await wallet.connect()

      const sessionDeleteHandler = mockPeraWallet.client.on.mock.calls.find(
        (call) => call[0] === 'session_delete'
      )?.[1] as (() => void) | undefined

      expect(sessionDeleteHandler).toBeDefined()

      if (sessionDeleteHandler) {
        sessionDeleteHandler()
      }

      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(mockPeraWallet.reconnectSession).not.toHaveBeenCalled()
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
          [WalletId.PERA2]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockPeraWallet.reconnectSession.mockResolvedValueOnce([account1.address])

      await wallet.resumeSession()

      expect(mockPeraWallet.reconnectSession).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.PERA2]).toEqual(walletState)
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if accounts do not match', async () => {
      // Stored accounts are 'mockAddress1' and 'mockAddress2'
      const prevWalletState: WalletState = {
        accounts: [
          {
            name: 'Pera Account 1',
            address: 'mockAddress1'
          },
          {
            name: 'Pera Account 2',
            address: 'mockAddress2'
          }
        ],
        activeAccount: {
          name: 'Pera Account 1',
          address: 'mockAddress1'
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.PERA2]: prevWalletState
        }
      })

      wallet = createWalletWithStore(store)

      // Client only returns 'mockAddress2' on reconnect, 'mockAddress1' is missing
      const newAccounts = ['mockAddress2']

      const newWalletState: WalletState = {
        accounts: [
          {
            name: 'Pera Account 1', // auto-generated name
            address: 'mockAddress2'
          }
        ],
        activeAccount: {
          name: 'Pera Account 1',
          address: 'mockAddress2'
        }
      }

      mockPeraWallet.reconnectSession.mockResolvedValueOnce(newAccounts)

      await wallet.resumeSession()

      expect(mockLogger.warn).toHaveBeenCalledWith('Session accounts mismatch, updating accounts', {
        prev: prevWalletState.accounts,
        current: newWalletState.accounts
      })
      expect(store.state.wallets[WalletId.PERA2]).toEqual(newWalletState)
    })

    it('should throw an error and disconnect if reconnectSession fails', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.PERA2]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockPeraWallet.reconnectSession.mockRejectedValueOnce(new Error('Reconnect error'))

      await expect(wallet.resumeSession()).rejects.toThrow('Reconnect error')
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error and disconnect if no accounts are found', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.PERA2]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockPeraWallet.reconnectSession.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.resumeSession()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.PERA2]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
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

    const sTxn = new Uint8Array([1, 2, 3, 4])

    beforeEach(async () => {
      // Mock two connected accounts
      mockPeraWallet.connect.mockResolvedValueOnce([connectedAcct1, connectedAcct2])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should process and sign a single algosdk.Transaction', async () => {
        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn])

        await wallet.signTransactions([txn1])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([[{ txn: txn1 }]])
      })

      it('should process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2 }, { txn: gtxn3 }]
        ])
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn, sTxn])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: g1txn1 }, { txn: g1txn2 }, { txn: g2txn1 }, { txn: g2txn2 }]
        ])
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn])

        await wallet.signTransactions([encodedTxn])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: algosdk.decodeUnsignedTransaction(encodedTxn) }]
        ])
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [
            { txn: algosdk.decodeUnsignedTransaction(gtxn1) },
            { txn: algosdk.decodeUnsignedTransaction(gtxn2) },
            { txn: algosdk.decodeUnsignedTransaction(gtxn3) }
          ]
        ])
      })

      it('should process and sign multiple encoded transaction groups', async () => {
        const txnGroup1 = algosdk.assignGroupID([txn1, txn2])
        const [g1txn1, g1txn2] = txnGroup1.map((txn) => txn.toByte())

        const txnGroup2 = algosdk.assignGroupID([txn3, txn4])
        const [g2txn1, g2txn2] = txnGroup2.map((txn) => txn.toByte())

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn, sTxn])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [
            { txn: algosdk.decodeUnsignedTransaction(g1txn1) },
            { txn: algosdk.decodeUnsignedTransaction(g1txn2) },
            { txn: algosdk.decodeUnsignedTransaction(g2txn1) },
            { txn: algosdk.decodeUnsignedTransaction(g2txn2) }
          ]
        ])
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const [gtxn1, gtxn2, gtxn3, gtxn4] = algosdk.assignGroupID([txn1, txn2, txn3, txn4])

        const txnGroup = [gtxn1, gtxn2, gtxn3, gtxn4]
        const indexesToSign = [0, 1, 3]

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          sTxn,
          sTxn,
          null,
          sTxn
        ])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2 }, { txn: gtxn3, signers: [] }, { txn: gtxn4 }]
        ])
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

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

        await expect(wallet.signTransactions([gtxn1, gtxn2, gtxn3])).resolves.toEqual([
          sTxn,
          null,
          sTxn
        ])

        expect(mockPeraWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2, signers: [] }, { txn: gtxn3 }]
        ])
      })

      it('should insert null values in response for transactions that were not signed', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const indexesToSign = [0, 2]

        mockPeraWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          sTxn,
          null,
          sTxn
        ])
      })
    })

    describe('transactionSigner', () => {
      it('should call signTransactions with the correct arguments', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const indexesToSign = [1]

        const signTransactionsSpy = vi
          .spyOn(wallet, 'signTransactions')
          .mockImplementationOnce(() => Promise.resolve([sTxn]))

        await wallet.transactionSigner(txnGroup, indexesToSign)

        expect(signTransactionsSpy).toHaveBeenCalledWith(txnGroup, indexesToSign)
      })
    })
  })
})
