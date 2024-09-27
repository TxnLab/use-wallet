import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { DeflyWallet } from 'src/wallets/defly'
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

const mockDeflyWallet = {
  connect: vi.fn(),
  reconnectSession: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  connector: {
    on: vi.fn(),
    off: vi.fn()
  }
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
  const wallet = new DeflyWallet({
    id: WalletId.DEFLY,
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn()
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockDeflyWallet

  return wallet
}

describe('DeflyWallet', () => {
  let wallet: DeflyWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

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

    let mockWalletConnectData: string | null = null

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      if (key === 'walletconnect') {
        return mockWalletConnectData
      }
      return null
    })

    vi.mocked(StorageAdapter.setItem).mockImplementation((key: string, value: string) => {
      if (key === LOCAL_STORAGE_KEY) {
        mockInitialState = JSON.parse(value)
      }
      if (key.startsWith('walletconnect-')) {
        mockWalletConnectData = value
      }
    })

    vi.mocked(StorageAdapter.removeItem).mockImplementation((key: string) => {
      if (key === 'walletconnect') {
        mockWalletConnectData = null
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

    it('should register disconnect event listener after successful connection', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      await wallet.connect()

      expect(mockDeflyWallet.connector.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should backup WalletConnect session when connecting and another wallet is active', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])

      // Set Pera as the active wallet
      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.PERA
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.connect()

      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('backup', WalletId.PERA)
      expect(StorageAdapter.getItem).toHaveBeenCalledWith('walletconnect')
      expect(StorageAdapter.setItem).toHaveBeenCalledWith(
        `walletconnect-${WalletId.PERA}`,
        mockWalletConnectData
      )
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

    it('should backup and restore active wallet session when disconnecting non-active wallet', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      await wallet.connect()

      // Set Pera as the active wallet
      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.PERA
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.disconnect()

      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('backup', WalletId.PERA)
      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('restore', WalletId.PERA)
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
    })

    it('should not backup or restore session when disconnecting active wallet', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      await wallet.connect()

      // Set Defly as the active wallet
      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.DEFLY
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.disconnect()

      expect(manageWalletConnectSessionSpy).not.toHaveBeenCalled()
      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
    })

    it('should backup active wallet, restore inactive wallet, disconnect, and restore active wallet when disconnecting an inactive wallet', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      await wallet.connect()

      // Set Pera as the active wallet
      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.PERA
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.disconnect()

      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('backup', WalletId.PERA)
      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('restore', WalletId.DEFLY)
      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('restore', WalletId.PERA)
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
    })

    it('should not remove backup when disconnecting the active wallet', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      await wallet.connect()

      // Set Defly as the active wallet
      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.DEFLY
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.disconnect()

      expect(manageWalletConnectSessionSpy).not.toHaveBeenCalled()
      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
    })

    it('should throw an error if client.disconnect fails', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      mockDeflyWallet.disconnect.mockRejectedValueOnce(new Error('Disconnect error'))

      await wallet.connect()

      await expect(wallet.disconnect()).rejects.toThrow('Disconnect error')

      expect(store.state.wallets[WalletId.DEFLY]).toBeDefined()
      expect(wallet.isConnected).toBe(true)
    })
  })

  describe('disconnect event', () => {
    it('should handle disconnect event and update store', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address, account2.address])
      await wallet.connect()

      const disconnectHandler = mockDeflyWallet.connector.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1] as (() => void) | undefined

      expect(disconnectHandler).toBeDefined()

      if (disconnectHandler) {
        disconnectHandler()
      }

      expect(store.state.wallets[WalletId.DEFLY]).toBeUndefined()
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

      expect(mockLogger.warn).toHaveBeenCalledWith('Session accounts mismatch, updating accounts', {
        prev: prevWalletState.accounts,
        current: newWalletState.accounts
      })
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

  describe('setActive', () => {
    it('should set the wallet as active', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      wallet.setActive()

      expect(store.state.activeWallet).toBe(WalletId.DEFLY)
      expect(StorageAdapter.setItem).toHaveBeenCalledWith('walletconnect', mockWalletConnectData)
      expect(StorageAdapter.removeItem).toHaveBeenCalledWith(`walletconnect-${WalletId.DEFLY}`)
    })

    it('should backup current active wallet session and restore Pera session when setting active', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)

      store.setState((state) => ({
        ...state,
        activeWallet: WalletId.PERA,
        wallets: {
          ...state.wallets,
          [WalletId.DEFLY]: { accounts: [account1], activeAccount: account1 },
          [WalletId.PERA]: { accounts: [account2], activeAccount: account2 }
        }
      }))

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      wallet.setActive()

      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('backup', WalletId.PERA)
      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('restore')
      expect(store.state.activeWallet).toBe(WalletId.DEFLY)
    })
  })

  describe('manageWalletConnectSession', () => {
    it('should backup WalletConnect session', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('backup', WalletId.PERA)

      expect(StorageAdapter.getItem).toHaveBeenCalledWith('walletconnect')
      expect(StorageAdapter.setItem).toHaveBeenCalledWith(
        `walletconnect-${WalletId.PERA}`,
        mockWalletConnectData
      )
    })

    it('should not backup WalletConnect session if no data exists', async () => {
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(null)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('backup', WalletId.PERA)

      expect(StorageAdapter.getItem).toHaveBeenCalledWith('walletconnect')
      expect(StorageAdapter.setItem).not.toHaveBeenCalled()
      expect(StorageAdapter.removeItem).not.toHaveBeenCalled()
    })

    it('should restore WalletConnect session', () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(mockWalletConnectData)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('restore')

      expect(StorageAdapter.getItem).toHaveBeenCalledWith(`walletconnect-${WalletId.DEFLY}`)
      expect(StorageAdapter.setItem).toHaveBeenCalledWith('walletconnect', mockWalletConnectData)
      expect(StorageAdapter.removeItem).toHaveBeenCalledWith(`walletconnect-${WalletId.DEFLY}`)
    })

    it('should not restore WalletConnect session if no backup exists', () => {
      vi.mocked(StorageAdapter.getItem).mockReturnValueOnce(null)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('restore')

      expect(StorageAdapter.getItem).toHaveBeenCalledWith(`walletconnect-${WalletId.DEFLY}`)
      expect(StorageAdapter.setItem).not.toHaveBeenCalled()
      expect(StorageAdapter.removeItem).not.toHaveBeenCalled()
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
      mockDeflyWallet.connect.mockResolvedValueOnce([connectedAcct1, connectedAcct2])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should process and sign a single algosdk.Transaction', async () => {
        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn])

        await wallet.signTransactions([txn1])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([[{ txn: txn1 }]])
      })

      it('should process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2 }, { txn: gtxn3 }]
        ])
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn, sTxn])

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

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn])

        await wallet.signTransactions([encodedTxn])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: algosdk.decodeUnsignedTransaction(encodedTxn) }]
        ])
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn])

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

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn, sTxn])

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

        const txnGroup = [gtxn1, gtxn2, gtxn3, gtxn4]
        const indexesToSign = [0, 1, 3]

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn, sTxn])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          sTxn,
          sTxn,
          null,
          sTxn
        ])

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

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

        await expect(wallet.signTransactions([gtxn1, gtxn2, gtxn3])).resolves.toEqual([
          sTxn,
          null,
          sTxn
        ])

        expect(mockDeflyWallet.signTransaction).toHaveBeenCalledWith([
          [{ txn: gtxn1 }, { txn: gtxn2, signers: [] }, { txn: gtxn3 }]
        ])
      })

      it('should insert null values in response for transactions that were not signed', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const indexesToSign = [0, 2]

        mockDeflyWallet.signTransaction.mockResolvedValueOnce([sTxn, sTxn])

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
