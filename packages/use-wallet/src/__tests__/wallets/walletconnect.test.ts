import { Store } from '@tanstack/store'
import { ModalCtrl } from '@walletconnect/modal-core'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { NetworkId, caipChainId } from 'src/network'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { base64ToByteArray, byteArrayToBase64 } from 'src/utils'
import { WalletConnect } from 'src/wallets/walletconnect'
import { WalletId, WalletTransaction } from 'src/wallets/types'
import { SessionTypes } from '@walletconnect/types'
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

const mockSignClient = {
  on: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  request: vi.fn(),
  session: {
    get: vi.fn(),
    keys: [''],
    length: 0
  }
}

vi.mock('@walletconnect/sign-client', () => {
  return {
    SignClient: class {
      static init = vi.fn(() => Promise.resolve(mockSignClient))
    }
  }
})

vi.spyOn(ModalCtrl, 'open').mockImplementation(() => Promise.resolve())
vi.spyOn(ModalCtrl, 'close').mockImplementation(() => {})
vi.spyOn(ModalCtrl, 'subscribe').mockImplementation((_callback: (state: any) => void) => {
  return () => {}
})

function createMockSession(accounts: string[] = []): SessionTypes.Struct {
  return {
    namespaces: {
      algorand: {
        accounts: accounts.map((address) => `${caipChainId[NetworkId.TESTNET]}:${address}`),
        methods: ['algo_signTxn'],
        events: []
      }
    },
    topic: 'mock-topic',
    pairingTopic: '',
    relay: {
      protocol: ''
    },
    expiry: 0,
    acknowledged: false,
    controller: '',
    requiredNamespaces: {
      algorand: {
        chains: [
          caipChainId[NetworkId.MAINNET]!,
          caipChainId[NetworkId.TESTNET]!,
          caipChainId[NetworkId.BETANET]!
        ],
        methods: ['algo_signTxn'],
        events: []
      }
    },
    optionalNamespaces: {},
    self: {
      publicKey: '',
      metadata: {
        name: '',
        description: '',
        url: '',
        icons: []
      }
    },
    peer: {
      publicKey: '',
      metadata: {
        name: '',
        description: '',
        url: '',
        icons: []
      }
    }
  }
}

function createWalletWithStore(store: Store<State>): WalletConnect {
  return new WalletConnect({
    id: WalletId.WALLETCONNECT,
    options: {
      projectId: 'mockProjectId'
    },
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn()
  })
}

describe('WalletConnect', () => {
  let wallet: WalletConnect
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'WalletConnect Account 1',
    address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
  }
  const account2 = {
    name: 'WalletConnect Account 2',
    address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
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
      const mockSession = createMockSession([account1.address, account2.address])
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if no URI is returned', async () => {
      const mockSession = createMockSession([])
      mockSignClient.connect.mockResolvedValueOnce({
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await expect(wallet.connect()).rejects.toThrow('No URI found')

      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      const mockSession = createMockSession([])
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')

      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      const mockSession = createMockSession([account1.address, account2.address])
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await wallet.connect()
      await wallet.disconnect()

      expect(mockSignClient.disconnect).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
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
          [WalletId.WALLETCONNECT]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      const mockSession = createMockSession([account1.address])
      mockSignClient.session.get.mockImplementationOnce(() => mockSession)

      const mockSessionKey = 'mockSessionKey'
      mockSignClient.session.keys = [mockSessionKey]
      mockSignClient.session.length = 1

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toEqual(walletState)
    })

    it('should update the store if accounts do not match', async () => {
      // Stored accounts are '7ZUECA' and 'GD64YI'
      const prevWalletState = {
        accounts: [
          {
            name: 'WalletConnect Account 1',
            address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
          },
          {
            name: 'WalletConnect Account 2',
            address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
          }
        ],
        activeAccount: {
          name: 'WalletConnect Account 1',
          address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.WALLETCONNECT]: prevWalletState
        }
      })

      wallet = createWalletWithStore(store)

      const newAccounts = ['GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A']

      const newWalletState: WalletState = {
        accounts: [
          {
            name: 'WalletConnect Account 1',
            address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
          }
        ],
        activeAccount: {
          name: 'WalletConnect Account 1',
          address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
        }
      }

      // Client only returns 'GD64YI' on reconnect
      const mockSession = createMockSession(newAccounts)
      mockSignClient.session.get.mockImplementationOnce(() => mockSession)

      await wallet.resumeSession()

      expect(mockLogger.warn).toHaveBeenCalledWith('Session accounts mismatch, updating accounts', {
        prev: prevWalletState.accounts,
        current: newWalletState.accounts
      })
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toEqual(newWalletState)
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

    const expectedRpcRequest = (params: WalletTransaction[][]) => {
      return {
        chainId: caipChainId[NetworkId.TESTNET],
        topic: 'mock-topic',
        request: expect.objectContaining({
          jsonrpc: '2.0',
          method: 'algo_signTxn',
          params
        })
      }
    }

    beforeEach(async () => {
      // Mock two connected accounts
      const mockSession = createMockSession([account1.address, account2.address])
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      const mockSignedTxn = byteArrayToBase64(txn1.toByte())
      mockSignClient.request.mockResolvedValue([mockSignedTxn])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should process and sign a single algosdk.Transaction', async () => {
        await wallet.signTransactions([txn1])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([[{ txn: byteArrayToBase64(txn1.toByte()) }]])
        )
      })

      it('should process and sign a single algosdk.Transaction group', async () => {
        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])
        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(gtxn1.toByte()) },
              { txn: byteArrayToBase64(gtxn2.toByte()) },
              { txn: byteArrayToBase64(gtxn3.toByte()) }
            ]
          ])
        )
      })

      it('should process and sign multiple algosdk.Transaction groups', async () => {
        const [g1txn1, g1txn2] = algosdk.assignGroupID([txn1, txn2])
        const [g2txn1, g2txn2] = algosdk.assignGroupID([txn3, txn4])

        await wallet.signTransactions([
          [g1txn1, g1txn2],
          [g2txn1, g2txn2]
        ])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(g1txn1.toByte()) },
              { txn: byteArrayToBase64(g1txn2.toByte()) },
              { txn: byteArrayToBase64(g2txn1.toByte()) },
              { txn: byteArrayToBase64(g2txn2.toByte()) }
            ]
          ])
        )
      })

      it('should process and sign a single encoded transaction', async () => {
        const encodedTxn = txn1.toByte()
        await wallet.signTransactions([encodedTxn])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([[{ txn: byteArrayToBase64(txn1.toByte()) }]])
        )
      })

      it('should process and sign a single encoded transaction group', async () => {
        const txnGroup = algosdk.assignGroupID([txn1, txn2, txn3])
        const [gtxn1, gtxn2, gtxn3] = txnGroup.map((txn) => txn.toByte())

        await wallet.signTransactions([gtxn1, gtxn2, gtxn3])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(gtxn1) },
              { txn: byteArrayToBase64(gtxn2) },
              { txn: byteArrayToBase64(gtxn3) }
            ]
          ])
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

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(g1txn1) },
              { txn: byteArrayToBase64(g1txn2) },
              { txn: byteArrayToBase64(g2txn1) },
              { txn: byteArrayToBase64(g2txn2) }
            ]
          ])
        )
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const [gtxn1, gtxn2, gtxn3, gtxn4] = algosdk.assignGroupID([txn1, txn2, txn3, txn4])
        const txnGroup = [gtxn1, gtxn2, gtxn3, gtxn4]
        const indexesToSign = [0, 1, 3]

        const gtxn1String = byteArrayToBase64(gtxn1.toByte())
        const gtxn2String = byteArrayToBase64(gtxn2.toByte())
        const gtxn4String = byteArrayToBase64(gtxn4.toByte())

        // Mock signClient.request to return "signed" (not really) base64 transactions or null
        mockSignClient.request.mockResolvedValueOnce([gtxn1String, gtxn2String, null, gtxn4String])

        await expect(wallet.signTransactions(txnGroup, indexesToSign)).resolves.toEqual([
          base64ToByteArray(gtxn1String),
          base64ToByteArray(gtxn2String),
          null,
          base64ToByteArray(gtxn4String)
        ])

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(gtxn1.toByte()) },
              { txn: byteArrayToBase64(gtxn2.toByte()) },
              { txn: byteArrayToBase64(gtxn3.toByte()), signers: [] },
              { txn: byteArrayToBase64(gtxn4.toByte()) }
            ]
          ])
        )
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

        expect(mockSignClient.request).toHaveBeenCalledWith(
          expectedRpcRequest([
            [
              { txn: byteArrayToBase64(gtxn1.toByte()) },
              { txn: byteArrayToBase64(gtxn2.toByte()), signers: [] },
              { txn: byteArrayToBase64(gtxn3.toByte()) }
            ]
          ])
        )
      })

      it('should return encoded signed transactions if the wallet returns base64 strings', async () => {
        const signedTxn = byteArrayToBase64(txn1.toByte())
        mockSignClient.request.mockResolvedValueOnce([signedTxn])

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([txn1.toByte()])
      })

      it('should return encoded signed transactions if the wallet returns Uint8Arrays', async () => {
        const signedTxn = txn1.toByte()
        mockSignClient.request.mockResolvedValueOnce([signedTxn])

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([txn1.toByte()])
      })

      it('should return encoded signed transactions if the wallet returns untyped byte arrays', async () => {
        const signedTxn = Array.from(txn1.toByte())
        mockSignClient.request.mockResolvedValueOnce([signedTxn])

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([txn1.toByte()])
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
