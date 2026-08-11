import algosdk from 'algosdk'
import { WalletConnectAdapter } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import { byteArrayToBase64, base64ToByteArray } from '@txnlab/use-wallet/adapter'
import type { AdapterStoreAccessor, WalletTransaction } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'
import type { SessionTypes } from '@walletconnect/types'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

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

const mockModal = {
  openModal: vi.fn(() => Promise.resolve()),
  closeModal: vi.fn(),
  subscribeModal: vi.fn((_callback: (state: any) => void) => {
    return () => {}
  })
}

vi.mock('@walletconnect/modal', () => {
  return {
    WalletConnectModal: vi.fn(() => mockModal)
  }
})

const WALLET_ID = 'walletconnect'

function createMockSession(accounts: string[], caipChainId: string): SessionTypes.Struct {
  return {
    namespaces: {
      algorand: {
        accounts: accounts.map((address) => `${caipChainId}:${address}`),
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
        chains: [caipChainId],
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

function createWallet(
  store: AdapterStoreAccessor,
  options?: Record<string, unknown>
): WalletConnectAdapter {
  return new WalletConnectAdapter({
    id: WALLET_ID,
    metadata: WalletConnectAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any,
    options: { projectId: 'mockProjectId', ...options } as any
  })
}

describe('WalletConnectAdapter', () => {
  let wallet: WalletConnectAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

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

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor

    wallet = createWallet(accessor)
  })

  afterEach(async () => {
    await wallet.disconnect()
  })

  describe('constructor', () => {
    it('should throw an error if projectId is not provided', () => {
      expect(
        () =>
          new WalletConnectAdapter({
            id: WALLET_ID,
            metadata: WalletConnectAdapter.defaultMetadata,
            store: accessor,
            subscribe: vi.fn(),
            getAlgodClient: () => ({}) as any,
            options: {} as any
          })
      ).toThrow('Missing required option: projectId')
    })
  })

  describe('connect', () => {
    it('should initialize client, return accounts, and update store', async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([account1.address, account2.address], caipChainId)
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if no URI is returned', async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([], caipChainId)
      mockSignClient.connect.mockResolvedValueOnce({
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await expect(wallet.connect()).rejects.toThrow('No URI found')

      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([], caipChainId)
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')

      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should use the active chain when connecting', async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([account1.address], caipChainId)
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await wallet.connect()

      expect(mockSignClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredNamespaces: {
            algorand: expect.objectContaining({
              chains: [wallet.activeChainId]
            })
          }
        })
      )
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([account1.address, account2.address], caipChainId)
      mockSignClient.connect.mockResolvedValueOnce({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      await wallet.connect()
      await wallet.disconnect()

      expect(mockSignClient.disconnect).toHaveBeenCalled()
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

      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([account1.address], caipChainId)
      mockSignClient.session.get.mockImplementationOnce(() => mockSession)

      const mockSessionKey = 'mockSessionKey'
      mockSignClient.session.keys = [mockSessionKey]
      mockSignClient.session.length = 1

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
    })

    it('should update the store if accounts do not match', async () => {
      const prevWalletState: WalletState = {
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

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: prevWalletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      const newAccounts = ['GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A']
      const caipChainId = wallet.activeChainId

      const mockSession = createMockSession(newAccounts, caipChainId)
      mockSignClient.session.get.mockImplementationOnce(() => mockSession)

      mockSignClient.session.keys = ['mockSessionKey']
      mockSignClient.session.length = 1

      await wallet.resumeSession()

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

      expect(store.state.wallets[WALLET_ID]).toEqual(newWalletState)
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

    const expectedRpcRequest = (params: WalletTransaction[][]) => {
      return {
        chainId: wallet.activeChainId,
        topic: 'mock-topic',
        request: expect.objectContaining({
          jsonrpc: '2.0',
          method: 'algo_signTxn',
          params
        })
      }
    }

    beforeEach(async () => {
      const caipChainId = wallet.activeChainId
      const mockSession = createMockSession([account1.address, account2.address], caipChainId)
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
        const canSignTxn1 = makePayTxn({ sender: connectedAcct1, amount: 1000 })
        const cannotSignTxn2 = makePayTxn({ sender: notConnectedAcct, amount: 2000 })
        const canSignTxn3 = makePayTxn({ sender: connectedAcct2, amount: 3000 })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
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

  describe('activeChainId', () => {
    it('should return the correct CAIP-2 chain ID for the active network', () => {
      expect(wallet.activeChainId).toBe(
        store.state.networkConfig[store.state.activeNetwork].caipChainId
      )
    })

    it('should return an empty string if no CAIP-2 chain ID is found', () => {
      // Create a harness with a custom network that has no caipChainId
      const harness = createTestHarness(WALLET_ID, {
        activeNetwork: 'invalid-network'
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      expect(wallet.activeChainId).toBe('')
    })
  })
})
