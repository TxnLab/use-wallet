import algosdk from 'algosdk'
import { DeflyAdapter } from './adapter'
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

vi.mock('@blockshake/defly-connect', () => ({
  DeflyWalletConnect: vi.fn(() => mockDeflyWallet)
}))

const WALLET_ID = 'defly'

function createWallet(store: AdapterStoreAccessor): DeflyAdapter {
  const wallet = new DeflyAdapter({
    id: WALLET_ID,
    metadata: DeflyAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockDeflyWallet

  return wallet
}

describe('DeflyAdapter', () => {
  let wallet: DeflyAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

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

    // Stub localStorage for manageWalletConnectSession
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    })

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
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      mockDeflyWallet.connect.mockRejectedValueOnce(new Error('Auth error'))

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockDeflyWallet.connect.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should register disconnect event listener after successful connection', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      await wallet.connect()

      expect(mockDeflyWallet.connector.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should backup WalletConnect session when connecting and another wallet is active', async () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      localStorage.setItem('walletconnect', mockWalletConnectData)

      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])

      // Set Pera as the active wallet
      const harness = createTestHarness(WALLET_ID, {
        activeWallet: 'pera'
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      const manageWalletConnectSessionSpy = vi.spyOn(wallet, 'manageWalletConnectSession' as any)

      await wallet.connect()

      expect(manageWalletConnectSessionSpy).toHaveBeenCalledWith('backup', 'pera')
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      await wallet.disconnect()

      expect(mockDeflyWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if client.disconnect fails', async () => {
      mockDeflyWallet.connect.mockResolvedValueOnce([account1.address])
      mockDeflyWallet.disconnect.mockRejectedValueOnce(new Error('Disconnect error'))

      await wallet.connect()

      await expect(wallet.disconnect()).rejects.toThrow('Disconnect error')

      expect(store.state.wallets[WALLET_ID]).toBeDefined()
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

      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
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

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      mockDeflyWallet.reconnectSession.mockResolvedValueOnce([account1.address])

      await wallet.resumeSession()

      expect(mockDeflyWallet.reconnectSession).toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if accounts do not match', async () => {
      const prevWalletState: WalletState = {
        accounts: [
          { name: 'Defly Account 1', address: 'mockAddress1' },
          { name: 'Defly Account 2', address: 'mockAddress2' }
        ],
        activeAccount: { name: 'Defly Account 1', address: 'mockAddress1' }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: prevWalletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      // Client only returns 'mockAddress2' on reconnect
      mockDeflyWallet.reconnectSession.mockResolvedValueOnce(['mockAddress2'])

      await wallet.resumeSession()

      const newWalletState: WalletState = {
        accounts: [{ name: 'Defly Account 1', address: 'mockAddress2' }],
        activeAccount: { name: 'Defly Account 1', address: 'mockAddress2' }
      }

      expect(store.state.wallets[WALLET_ID]).toEqual(newWalletState)
    })

    it('should throw an error and disconnect if reconnectSession fails', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      mockDeflyWallet.reconnectSession.mockRejectedValueOnce(new Error('Reconnect error'))

      await expect(wallet.resumeSession()).rejects.toThrow('Reconnect error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error and disconnect if no accounts are found', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      mockDeflyWallet.reconnectSession.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.resumeSession()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should skip reconnectSession if Pera is active', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        activeWallet: 'pera',
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      await wallet.resumeSession()

      expect(mockDeflyWallet.reconnectSession).not.toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
    })
  })

  describe('manageWalletConnectSession', () => {
    it('should backup WalletConnect session', () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      localStorage.setItem('walletconnect', mockWalletConnectData)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('backup', 'pera')

      expect(localStorage.getItem('walletconnect-pera')).toBe(mockWalletConnectData)
      expect(localStorage.getItem('walletconnect')).toBeNull()
    })

    it('should not backup WalletConnect session if no data exists', () => {
      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('backup', 'pera')

      expect(localStorage.getItem('walletconnect-pera')).toBeNull()
    })

    it('should restore WalletConnect session', () => {
      const mockWalletConnectData = 'mockWalletConnectData'
      localStorage.setItem(`walletconnect-${WALLET_ID}`, mockWalletConnectData)

      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('restore')

      expect(localStorage.getItem('walletconnect')).toBe(mockWalletConnectData)
      expect(localStorage.getItem(`walletconnect-${WALLET_ID}`)).toBeNull()
    })

    it('should not restore WalletConnect session if no backup exists', () => {
      // @ts-expect-error - Accessing protected method for testing
      wallet.manageWalletConnectSession('restore')

      expect(localStorage.getItem('walletconnect')).toBeNull()
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

    const sTxn = new Uint8Array([1, 2, 3, 4])

    beforeEach(async () => {
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
        const canSignTxn1 = makePayTxn({ sender: connectedAcct1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: connectedAcct2, amount: 3000 })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
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
