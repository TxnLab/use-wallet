import algosdk from 'algosdk'
import { PeraAdapter } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import { ScopeType, type AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

const mockPeraWallet = {
  connect: vi.fn(),
  reconnectSession: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn(),
  signArc60Data: vi.fn(),
  connector: {
    on: vi.fn(),
    off: vi.fn()
  }
}

vi.mock('@perawallet/connect', () => ({
  PeraWalletConnect: vi.fn(() => mockPeraWallet)
}))

const WALLET_ID = 'pera'

function createWallet(
  store: AdapterStoreAccessor,
  getAlgodClient: () => any = () => ({}) as any
): PeraAdapter {
  const wallet = new PeraAdapter({
    id: WALLET_ID,
    metadata: PeraAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockPeraWallet

  return wallet
}

describe('PeraAdapter', () => {
  let wallet: PeraAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

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
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      mockPeraWallet.connect.mockRejectedValueOnce(new Error('Auth error'))

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockPeraWallet.connect.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should register disconnect event listener after successful connection', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])

      await wallet.connect()

      expect(mockPeraWallet.connector.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      await wallet.disconnect()

      expect(mockPeraWallet.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if client.disconnect fails', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address])
      mockPeraWallet.disconnect.mockRejectedValueOnce(new Error('Disconnect error'))

      await wallet.connect()

      await expect(wallet.disconnect()).rejects.toThrow('Disconnect error')

      expect(store.state.wallets[WALLET_ID]).toBeDefined()
      expect(wallet.isConnected).toBe(true)
    })
  })

  describe('disconnect event', () => {
    it('should handle disconnect event and update store', async () => {
      mockPeraWallet.connect.mockResolvedValueOnce([account1.address, account2.address])
      await wallet.connect()

      const disconnectHandler = mockPeraWallet.connector.on.mock.calls.find(
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

      expect(mockPeraWallet.reconnectSession).not.toHaveBeenCalled()
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

      mockPeraWallet.reconnectSession.mockResolvedValueOnce([account1.address])

      await wallet.resumeSession()

      expect(mockPeraWallet.reconnectSession).toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
      expect(wallet.isConnected).toBe(true)
    })

    it('should update the store if accounts do not match', async () => {
      const prevWalletState: WalletState = {
        accounts: [
          { name: 'Pera Account 1', address: 'mockAddress1' },
          { name: 'Pera Account 2', address: 'mockAddress2' }
        ],
        activeAccount: { name: 'Pera Account 1', address: 'mockAddress1' }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: prevWalletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      // Client only returns 'mockAddress2' on reconnect
      mockPeraWallet.reconnectSession.mockResolvedValueOnce(['mockAddress2'])

      await wallet.resumeSession()

      const newWalletState: WalletState = {
        accounts: [{ name: 'Pera Account 1', address: 'mockAddress2' }],
        activeAccount: { name: 'Pera Account 1', address: 'mockAddress2' }
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

      mockPeraWallet.reconnectSession.mockRejectedValueOnce(new Error('Reconnect error'))

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

      mockPeraWallet.reconnectSession.mockImplementation(() => Promise.resolve([]))

      await expect(wallet.resumeSession()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should skip reconnectSession if Defly is active', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      const harness = createTestHarness(WALLET_ID, {
        activeWallet: 'defly',
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      await wallet.resumeSession()

      expect(mockPeraWallet.reconnectSession).not.toHaveBeenCalled()
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
    })

    describe('auto-connect in Pera browser', () => {
      let mockUserAgent: string

      beforeEach(() => {
        mockUserAgent = ''
        vi.clearAllMocks()

        vi.stubGlobal('window', {
          navigator: {
            get userAgent() {
              return mockUserAgent
            }
          }
        })

        const harness = createTestHarness(WALLET_ID)
        store = harness.store
        wallet = createWallet(harness.accessor)
      })

      afterEach(() => {
        vi.unstubAllGlobals()
      })

      it('should attempt auto-connect in Pera browser when no session exists', async () => {
        mockUserAgent = 'pera/1.0.0'
        mockPeraWallet.connect.mockResolvedValueOnce([account1.address])

        await wallet.resumeSession()

        expect(mockPeraWallet.connect).toHaveBeenCalled()
        expect(store.state.wallets[WALLET_ID]).toBeDefined()
      })

      it('should not attempt auto-connect if another wallet is active', async () => {
        mockUserAgent = 'pera/1.0.0'

        const harness = createTestHarness(WALLET_ID, {
          activeWallet: 'defly',
          wallets: {
            defly: { accounts: [account2], activeAccount: account2 }
          }
        })
        store = harness.store
        wallet = createWallet(harness.accessor)

        await wallet.resumeSession()

        expect(mockPeraWallet.connect).not.toHaveBeenCalled()
      })

      it('should not attempt auto-connect in other browsers', async () => {
        mockUserAgent = 'chrome/1.0.0'

        await wallet.resumeSession()

        expect(mockPeraWallet.connect).not.toHaveBeenCalled()
      })

      it('should handle auto-connect failure gracefully', async () => {
        mockUserAgent = 'pera/1.0.0'
        mockPeraWallet.connect.mockRejectedValueOnce(new Error('Connect failed'))

        await wallet.resumeSession()

        expect(mockPeraWallet.connect).toHaveBeenCalled()
        expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      })
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
        const canSignTxn1 = makePayTxn({ sender: connectedAcct1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: connectedAcct2, amount: 3000 })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
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

  describe('signData', () => {
    // Connected account
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
    const testDomain = 'test.domain'

    const sha256 = async (data: BufferSource): Promise<Uint8Array> => {
      const buf = await crypto.subtle.digest('SHA-256', data)
      return new Uint8Array(buf)
    }

    const mockAlgodClient = {
      accountInformation: vi.fn()
    }

    beforeEach(async () => {
      vi.stubGlobal('location', { host: testDomain })

      mockAlgodClient.accountInformation.mockReturnValue({
        do: vi.fn().mockResolvedValue({})
      })

      wallet = createWallet(accessor, () => mockAlgodClient)

      mockPeraWallet.connect.mockResolvedValueOnce([connectedAcct1])
      await wallet.connect()
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should have canSignData set to true', () => {
      expect(wallet.canSignData).toBe(true)
    })

    it('should construct StdSignData and call Pera client signArc60Data with correct parameters', async () => {
      const testData = 'test-data'
      const testMetadata = { scope: ScopeType.AUTH, encoding: 'base64' }

      const expectedStdSignData = {
        data: testData,
        signer: algosdk.Address.fromString(connectedAcct1).publicKey,
        domain: testDomain,
        authenticatorData: await sha256(new TextEncoder().encode(testDomain))
      }

      const mockResponse = {
        ...expectedStdSignData,
        signature: new Uint8Array([7, 8, 9])
      }

      mockPeraWallet.signArc60Data.mockResolvedValue(mockResponse)

      const result = await wallet.signData(testData, testMetadata)

      expect(mockAlgodClient.accountInformation).toHaveBeenCalledWith(connectedAcct1)
      expect(mockPeraWallet.signArc60Data).toHaveBeenCalledWith(expectedStdSignData, testMetadata)
      expect(result).toEqual(mockResponse)
    })

    it('should sign with the auth address public key for rekeyed accounts', async () => {
      const authAddr = new algosdk.Address(new Uint8Array(32).fill(7))
      mockAlgodClient.accountInformation.mockReturnValue({
        do: vi.fn().mockResolvedValue({ authAddr })
      })

      mockPeraWallet.signArc60Data.mockResolvedValue({
        data: 'test-data',
        signer: authAddr.publicKey,
        domain: testDomain,
        authenticatorData: await sha256(new TextEncoder().encode(testDomain)),
        signature: new Uint8Array([7, 8, 9])
      })

      await wallet.signData('test-data', { scope: ScopeType.AUTH, encoding: 'base64' })

      expect(mockPeraWallet.signArc60Data).toHaveBeenCalledWith(
        expect.objectContaining({ signer: authAddr.publicKey }),
        { scope: ScopeType.AUTH, encoding: 'base64' }
      )
    })

    it('should normalize user cancellation to SignDataError with code 4001', async () => {
      const peraError = Object.assign(new Error('Sign data cancelled'), {
        data: { type: 'SIGN_DATA_CANCELLED' }
      })
      mockPeraWallet.signArc60Data.mockRejectedValueOnce(peraError)

      await expect(
        wallet.signData('test-data', { scope: ScopeType.AUTH, encoding: 'base64' })
      ).rejects.toMatchObject({
        name: 'SignDataError',
        message: 'Sign data cancelled',
        code: 4001
      })
    })

    it('should normalize other Pera signing errors to SignDataError with code 4300', async () => {
      const peraError = Object.assign(new Error('Domain mismatch'), {
        data: { type: 'SIGN_DATA_DOMAIN_MISMATCH' }
      })
      mockPeraWallet.signArc60Data.mockRejectedValueOnce(peraError)

      await expect(
        wallet.signData('test-data', { scope: ScopeType.AUTH, encoding: 'base64' })
      ).rejects.toMatchObject({
        name: 'SignDataError',
        message: 'Domain mismatch',
        code: 4300
      })
    })

    it('should re-throw unrecognized errors unchanged', async () => {
      const unknownError = new Error('Network failure')
      mockPeraWallet.signArc60Data.mockRejectedValueOnce(unknownError)

      await expect(
        wallet.signData('test-data', { scope: ScopeType.AUTH, encoding: 'base64' })
      ).rejects.toBe(unknownError)
    })
  })
})
