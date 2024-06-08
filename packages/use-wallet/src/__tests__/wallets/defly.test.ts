import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { DeflyWallet } from 'src/wallets/defly'
import { WalletId } from 'src/wallets/types'

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

// Spy/suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {}) // @todo: remove when debug logger is implemented
vi.spyOn(console, 'warn').mockImplementation(() => {})

const mockDeflyWallet = {
  connect: vi.fn(),
  reconnectSession: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn()
}

vi.mock('@blockshake/defly-connect', async (importOriginal) => {
  const module = await importOriginal<typeof import('@blockshake/defly-connect')>()
  return {
    ...module,
    default: {
      ...module,
      DeflyWalletConnect: vi.fn(() => mockDeflyWallet)
    }
  }
})

function createWalletWithStore(store: Store<State>): DeflyWallet {
  return new DeflyWallet({
    id: WalletId.DEFLY,
    metadata: {},
    getAlgodClient: {} as any,
    store,
    subscribe: vi.fn()
  })
}

describe('DeflyWallet', () => {
  let wallet: DeflyWallet
  let store: Store<State>
  let mockInitialState: State | null = null

  const account1 = {
    name: 'Defly Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'Defly Account 2',
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

    store = new Store<State>(defaultState)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.DEFLY]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      mockDeflyWallet.connect.mockRejectedValueOnce(new Error('Auth error'))

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockDeflyWallet.connect.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      await wallet.disconnect()

      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if client.disconnect fails', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      mockDeflyWallet.disconnect.mockRejectedValueOnce(new Error('Disconnect error'))

      await wallet.connect()

      await expect(wallet.disconnect()).rejects.toThrow('Disconnect error')

      // Should still update store/state
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(mockDeflyWallet.reconnectSession).not.toHaveBeenCalled()
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
          [WalletId.DEFLY]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockDeflyWallet.reconnectSession.mockResolvedValueOnce([account1.address])

      await wallet.resumeSession()

      expect(mockDeflyWallet.reconnectSession).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.DEFLY]).toEqual(walletState)
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if accounts do not match', async () => {
      // Stored accounts are 'mockAddress1' and 'mockAddress2'
      const prevWalletState: WalletState = {
        accounts: [
          {
            name: 'Defly Account 1',
            address: 'mockAddress1'
          },
          {
            name: 'Defly Account 2',
            address: 'mockAddress2'
          }
        ],
        activeAccount: {
          name: 'Defly Account 1',
          address: 'mockAddress1'
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.DEFLY]: prevWalletState
        }
      })

      wallet = createWalletWithStore(store)

      // Client only returns 'mockAddress2' on reconnect, 'mockAddress1' is missing
      const newAccounts = ['mockAddress2']

      const newWalletState: WalletState = {
        accounts: [
          {
            name: 'Defly Account 1', // auto-generated name
            address: 'mockAddress2'
          }
        ],
        activeAccount: {
          name: 'Defly Account 1',
          address: 'mockAddress2'
        }
      }

      mockDeflyWallet.reconnectSession.mockResolvedValueOnce(newAccounts)

      await wallet.resumeSession()

      expect(console.warn).toHaveBeenCalledWith(
        '[Defly] Session accounts mismatch, updating accounts',
        {
          prev: prevWalletState.accounts,
          current: newWalletState.accounts
        }
      )
      expect(store.state.wallets[WalletId.DEFLY]).toEqual(newWalletState)
    })

    it('should throw an error and disconnect if reconnectSession fails', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.DEFLY]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockDeflyWallet.reconnectSession.mockRejectedValueOnce(new Error('Reconnect error'))

      await expect(wallet.resumeSession()).rejects.toThrow('Reconnect error')
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
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
          [WalletId.DEFLY]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      mockDeflyWallet.reconnectSession.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.resumeSession()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
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

    beforeEach(async () => {
      // Mock two connected accounts
      mockDeflyWallet.connect.mockResolvedValueOnce([connectedAcct1, connectedAcct2])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([[{ txn: txn1 }]])
      })

      it('should process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2 }, { txn: gtxn3 }]
        ])
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: g1txn1 }, { txn: g1txn2 }, { txn: g2txn1 }, { txn: g2txn2 }]
        ])
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: algosdk.decodeUnsignedTransaction(encodedTxn) }]
        ])
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
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

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
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
        const indexesToSign = [0, 1, 3]

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3, gtxn4], indexesToSign)

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
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

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2, signers: [] }, { txn: gtxn3 }]
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
