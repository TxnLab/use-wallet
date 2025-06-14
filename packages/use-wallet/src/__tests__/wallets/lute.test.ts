import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { canonify } from 'canonify'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, DEFAULT_STATE } from 'src/store'
import { byteArrayToBase64 } from 'src/utils'
import { ScopeType } from 'src/wallets'
import { LuteWallet } from 'src/wallets/lute'
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

// Mock lute-connect
vi.mock('lute-connect', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn(),
      signTxns: vi.fn(),
      signData: vi.fn(),
      siteName: 'Mock Site',
      forceWeb: false,
      isExtensionInstalled: vi.fn().mockResolvedValue(true)
    }))
  }
})

// Import the mocked module
import LuteConnect from 'lute-connect'

function createWalletWithStore(store: Store<State>): LuteWallet {
  return new LuteWallet({
    id: WalletId.LUTE,
    options: {
      siteName: 'Mock Site Name'
    },
    metadata: {},
    getAlgodClient: () =>
      ({
        genesis: () => ({
          do: () =>
            Promise.resolve(JSON.stringify({ id: 'mockGenesisID', network: 'mockGenesisNetwork' }))
        })
      }) as any,
    store,
    subscribe: vi.fn()
  })
}

interface MockLuteConnect {
  connect: Mock
  signTxns: Mock
  signData: Mock
  siteName: string
  forceWeb: boolean
  isExtensionInstalled: () => Promise<boolean>
}

describe('LuteWallet', () => {
  let wallet: LuteWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }
  let mockLuteConnect: MockLuteConnect

  const account1 = {
    name: 'Lute Account 1',
    address: 'mockAddress1'
  }
  const account2 = {
    name: 'Lute Account 2',
    address: 'mockAddress2'
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a mock instance of LuteConnect
    mockLuteConnect = {
      connect: vi.fn(),
      signTxns: vi.fn(),
      signData: vi.fn(),
      siteName: 'Mock Site',
      forceWeb: false,
      isExtensionInstalled: vi.fn().mockResolvedValue(true)
    }

    // Reset the mock implementation for LuteConnect
    vi.mocked(LuteConnect).mockImplementation(() => mockLuteConnect)

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
      const mockConnect = vi.fn().mockResolvedValue([account1.address, account2.address])
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      const accounts = await wallet.connect()

      expect(mockConnect).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.LUTE]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      const mockConnect = vi.fn().mockRejectedValue(new Error('Auth error'))
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      const mockConnect = vi.fn().mockResolvedValue([])
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      const mockConnect = vi.fn().mockResolvedValue(['mockAddress'])
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      await wallet.connect()
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
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
          [WalletId.LUTE]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.LUTE]).toEqual(walletState)
    })
  })

  describe('signing transactions', () => {
    // Connected accounts
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
    const connectedAcct2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

    // Not connected account
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

    // Transactions used in tests
    const txn1 = makePayTxn({ amount: 1000 })
    const txn2 = makePayTxn({ amount: 2000 })
    const txn3 = makePayTxn({ amount: 3000 })
    const txn4 = makePayTxn({ amount: 4000 })

    beforeEach(async () => {
      const mockConnect = vi.fn().mockResolvedValue([connectedAcct1, connectedAcct2])
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should re-throw SignTxnsError to the consuming application', async () => {
        const mockError = Object.assign(new Error('User Rejected Request'), { code: 4001 })
        const mockSignTxns = vi.fn().mockRejectedValue(mockError)
        vi.mocked(mockLuteConnect.signTxns).mockImplementation(mockSignTxns)

        await expect(wallet.signTransactions([txn1])).rejects.toMatchObject({
          name: 'SignTxnsError',
          message: 'User Rejected Request',
          code: 4001
        })
      })

      it('should process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(g1txn1.toByte()) },
          { txn: byteArrayToBase64(g1txn2.toByte()) },
          { txn: byteArrayToBase64(g2txn1.toByte()) },
          { txn: byteArrayToBase64(g2txn2.toByte()) }
        ])
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(txn1.toByte()) }
        ])
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1) },
          { txn: byteArrayToBase64(gtxn2) },
          { txn: byteArrayToBase64(gtxn3) }
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

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
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

        // Mock signTxns to return "signed" (not really) encoded transactions or null
        const mockSignTxns = vi
          .fn()
          .mockResolvedValue([gtxn1.toByte(), gtxn2.toByte(), null, gtxn4.toByte()])
        vi.mocked(mockLuteConnect.signTxns).mockImplementation(mockSignTxns)

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          gtxn1.toByte(),
          gtxn2.toByte(),
          null,
          gtxn4.toByte()
        ])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()) },
          { txn: byteArrayToBase64(gtxn3.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn4.toByte()) }
        ])
      })

      it('should only send transactions with connected signers for signature', async () => {
        const canSignTxn1 = makePayTxn({ sender: connectedAcct1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: connectedAcct2, amount: 3000 })

        // Signer for gtxn2 is not a connected account
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2, // Should not be signed
          canSignTxn3
        ])

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockLuteConnect.signTxns).toHaveBeenCalledWith([
          { txn: byteArrayToBase64(gtxn1.toByte()) },
          { txn: byteArrayToBase64(gtxn2.toByte()), signers: [] },
          { txn: byteArrayToBase64(gtxn3.toByte()) }
        ])
      })
    })

    describe('transactionSigner', () => {
      it('should call signTransactions with the correct arguments', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const indexesToSign = [1]

        const mockSignedTxns = [null, new Uint8Array([1, 2, 3])]
        const signTransactionsSpy = vi
          .spyOn(wallet, 'signTransactions')
          .mockResolvedValue(mockSignedTxns)

        const result = await wallet.transactionSigner(txnGroup, indexesToSign)

        expect(signTransactionsSpy).toHaveBeenCalledWith(txnGroup, indexesToSign)
        expect(result).toEqual([new Uint8Array([1, 2, 3])])
      })
    })
  })

  describe('signData', () => {
    // Connected accounts
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'

    beforeEach(async () => {
      const mockConnect = vi.fn().mockResolvedValue([connectedAcct1])
      vi.mocked(mockLuteConnect.connect).mockImplementation(mockConnect)

      await wallet.connect()
    })

    it('should have canSignData set to true', () => {
      expect(wallet.canSignData).toBe(true)
    })

    it('should call Lute client signData with correct parameters', async () => {
      const testData = 'test-data'
      const testMetadata = { scope: ScopeType.AUTH, encoding: 'base64' }

      const mockResponse = {
        data: testData,
        signer: new Uint8Array([1, 2, 3]),
        domain: 'test.domain',
        authenticatorData: new Uint8Array([4, 5, 6]),
        signature: new Uint8Array([7, 8, 9])
      }

      mockLuteConnect.signData.mockResolvedValue(mockResponse)

      const result = await wallet.signData(testData, testMetadata)

      expect(mockLuteConnect.signData).toHaveBeenCalledWith(testData, testMetadata)
      expect(result).toEqual(mockResponse)
    })

    it('should re-throw SignDataError to the consuming application', async () => {
      const mockError = Object.assign(new Error('User Rejected Request'), { code: 4300 })
      const mockSignData = vi.fn().mockRejectedValue(mockError)
      vi.mocked(mockLuteConnect.signData).mockImplementation(mockSignData)

      await expect(
        wallet.signData('test-data', { scope: ScopeType.AUTH, encoding: 'base64' })
      ).rejects.toMatchObject({
        name: 'SignDataError',
        message: 'User Rejected Request',
        code: 4300
      })
    })

    it('should handle sign and verify data flow', async () => {
      // Mock the data to be signed
      const siwaRequest = {
        domain: 'test.domain',
        chain_id: '283',
        account_address: connectedAcct1,
        type: 'ed25519',
        uri: 'https://test.domain',
        version: '1',
        'issued-at': new Date().toISOString()
      }

      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }

      // Create test authenticator data
      const testAuthData = new Uint8Array(32).fill(1)

      // Create a valid signature that would verify correctly
      const testSigner = new Uint8Array(algosdk.Address.fromString(connectedAcct1).publicKey)
      const testSignature = new Uint8Array(64).fill(9)

      // Setup the mock response
      const mockResponse = {
        data,
        signer: testSigner,
        domain: 'test.domain',
        authenticatorData: testAuthData,
        signature: testSignature
      }

      mockLuteConnect.signData.mockResolvedValue(mockResponse)

      // Call signData
      const response = await wallet.signData(data, metadata)

      // Verify the response
      expect(response).toEqual(mockResponse)
      expect(mockLuteConnect.signData).toHaveBeenCalledWith(data, metadata)

      // Verify response contains required fields
      expect(response.data).toBeDefined()
      expect(response.signer).toBeDefined()
      expect(response.domain).toBeDefined()
      expect(response.authenticatorData).toBeDefined()
      expect(response.signature).toBeDefined()
    })
  })
})
