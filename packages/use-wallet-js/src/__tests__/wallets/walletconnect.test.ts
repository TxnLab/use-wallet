import { Store } from '@tanstack/store'
import { ModalCtrl } from '@walletconnect/modal-core'
import * as msgpack from 'algo-msgpack-with-bigint'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { WalletConnect } from 'src/wallets/walletconnect'
import { WalletId, WalletTransaction } from 'src/wallets/types'

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

// Spy/suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})
vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
vi.spyOn(ModalCtrl, 'subscribe').mockImplementation((callback: (state: any) => void) => {
  return () => console.log('unsubscribe')
})

const createMockSessionStruct = (overrides = {}) => {
  const defaultSessionStruct = {
    namespaces: {
      algorand: {
        accounts: [],
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
          'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
          'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
          'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2'
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

  return { ...defaultSessionStruct, ...overrides }
}

describe('WalletConnect', () => {
  let wallet: WalletConnect
  let store: Store<State>
  let mockInitialState: State | null = null

  const mockSubscribe: (callback: (state: State) => void) => () => void = vi.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (callback: (state: State) => void) => {
      return () => console.log('unsubscribe')
    }
  )

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
    wallet = new WalletConnect({
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: 'mockProjectId'
      },
      metadata: {},
      getAlgodClient: () => ({}) as any,
      store,
      subscribe: mockSubscribe
    })
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, return account objects, and update store', async () => {
      const account1 = {
        name: 'WalletConnect 1',
        address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
      }
      const account2 = {
        name: 'WalletConnect 2',
        address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
      }

      const mockSession = createMockSessionStruct({
        namespaces: {
          algorand: {
            accounts: [
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
            ],
            methods: ['algo_signTxn'],
            events: []
          }
        }
      })

      mockSignClient.connect.mockResolvedValue({
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

    it('should log an error and return an empty array when no accounts are found', async () => {
      const mockSession = createMockSessionStruct()

      mockSignClient.connect.mockResolvedValue({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        '[WalletConnect] Error connecting: No accounts found!'
      )
      expect(accounts).toEqual([])
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      const mockSession = createMockSessionStruct({
        namespaces: {
          algorand: {
            accounts: [
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
            ],
            methods: ['algo_signTxn'],
            events: []
          }
        }
      })

      mockSignClient.connect.mockResolvedValue({
        uri: 'mock-uri',
        approval: vi.fn().mockResolvedValue(mockSession)
      })

      // Connect first to initialize client
      await wallet.connect()
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeDefined()

      await wallet.disconnect()
      expect(wallet.isConnected).toBe(false)

      expect(mockSignClient.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should automatically connect if WalletConnect wallet data is found in the store', async () => {
      const account = {
        name: 'WalletConnect 1',
        address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.WALLETCONNECT]: {
            accounts: [account],
            activeAccount: account
          }
        }
      })

      wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: {
          projectId: 'mockProjectId'
        },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: mockSubscribe
      })

      const mockSession = createMockSessionStruct({
        namespaces: {
          algorand: {
            accounts: [
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            ],
            methods: ['algo_signTxn'],
            events: []
          }
        }
      })

      mockSignClient.session.get.mockImplementation(() => mockSession)

      const mockSessionKey = 'mockSessionKey'
      mockSignClient.session.keys = [mockSessionKey]
      mockSignClient.session.length = 1

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeDefined()
    })

    it('should not automatically connect if WalletConnect wallet data is not found in the store', async () => {
      // No wallets in store
      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toBeUndefined()
    })

    it('should update the store if accounts returned by the client do not match', async () => {
      // Store contains '7ZUECA' and 'GD64YI', with '7ZUECA' as active
      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.WALLETCONNECT]: {
            accounts: [
              {
                name: 'WalletConnect 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              },
              {
                name: 'WalletConnect 2',
                address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
              }
            ],
            activeAccount: {
              name: 'WalletConnect 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        }
      })

      wallet = new WalletConnect({
        id: WalletId.WALLETCONNECT,
        options: {
          projectId: 'mockProjectId'
        },
        metadata: {},
        getAlgodClient: () => ({}) as any,
        store,
        subscribe: mockSubscribe
      })

      // Client only returns 'GD64YI' on reconnect, '7ZUECA' is missing
      const mockSession = createMockSessionStruct({
        namespaces: {
          algorand: {
            accounts: [
              'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
            ],
            methods: ['algo_signTxn'],
            events: []
          }
        }
      })

      mockSignClient.session.get.mockImplementation(() => mockSession)

      await wallet.resumeSession()

      expect(console.warn).toHaveBeenCalledWith(
        '[WalletConnect] Session accounts mismatch, updating accounts'
      )

      // Store now only contains 'GD64YI', which is set as active
      expect(store.state.wallets[WalletId.WALLETCONNECT]).toEqual({
        accounts: [
          {
            name: 'WalletConnect 1', // auto-generated name
            address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
          }
        ],
        activeAccount: {
          name: 'WalletConnect 1',
          address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
        }
      })
    })
  })

  describe('signTransactions', () => {
    describe('when the client is not initialized', () => {
      it('should throw an error', async () => {
        await expect(wallet.signTransactions([])).rejects.toThrowError(
          '[WalletConnect] Client not initialized!'
        )
      })
    })

    describe('when the client is initialized', () => {
      const txnParams = {
        fee: 10,
        firstRound: 51,
        lastRound: 61,
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        genesisID: 'mainnet-v1.0'
      }

      // Transactions used in tests
      const txn1 = new algosdk.Transaction({
        ...txnParams,
        from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        amount: 1000
      })
      const txn2 = new algosdk.Transaction({
        ...txnParams,
        from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        amount: 2000
      })

      // Signed transaction objects to be base64 encoded
      const signedTxnObj1 = {
        txn: Buffer.from(txn1.toByte()).toString('base64'),
        sig: 'mockBase64Signature'
      }
      const signedTxnObj2 = {
        txn: Buffer.from(txn2.toByte()).toString('base64'),
        sig: 'mockBase64Signature'
      }

      // Signed transactions (base64 strings) returned by Exodus extension
      const signedTxnStr1 = Buffer.from(
        new Uint8Array(msgpack.encode(signedTxnObj1, { sortKeys: true }))
      ).toString('base64')
      const signedTxnStr2 = Buffer.from(
        new Uint8Array(msgpack.encode(signedTxnObj2, { sortKeys: true }))
      ).toString('base64')

      // Signed transactions (Uint8Array) returned by ExodusWallet.signTransactions
      const signedTxnEncoded1 = new Uint8Array(Buffer.from(signedTxnStr1, 'base64'))
      const signedTxnEncoded2 = new Uint8Array(Buffer.from(signedTxnStr2, 'base64'))

      function createExpectedRpcRequest(params: WalletTransaction[][]) {
        return {
          chainId: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
          topic: 'mock-topic',
          request: expect.objectContaining({
            // ignore generated `id` property
            jsonrpc: '2.0',
            method: 'algo_signTxn',
            params
          })
        }
      }

      beforeEach(async () => {
        // Mock two connected accounts, 7ZUECA and GD64YI
        const mockSession = createMockSessionStruct({
          namespaces: {
            algorand: {
              accounts: [
                'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
                'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe:GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
              ],
              methods: ['algo_signTxn'],
              events: []
            }
          }
        })

        mockSignClient.connect.mockResolvedValue({
          uri: 'mock-uri',
          approval: vi.fn().mockResolvedValue(mockSession)
        })

        await wallet.connect()
      })

      it('should correctly process and sign a single algosdk.Transaction', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1])

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([signedTxnEncoded1])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

        const result = await wallet.signTransactions([txn1, txn2])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly process and sign multiple algosdk.Transaction groups', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

        const result = await wallet.signTransactions([[txn1], [txn2]])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1])

        const encodedTxn = txn1.toByte()
        const result = await wallet.signTransactions([encodedTxn])

        expect(result).toEqual([signedTxnEncoded1])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

        const txnGroup = [txn1, txn2]
        const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

        const result = await wallet.signTransactions(encodedTxnGroup)

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly process and sign multiple encoded transaction groups', async () => {
        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

        const result = await wallet.signTransactions([[txn1.toByte()], [txn2.toByte()]])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        mockSignClient.request.mockResolvedValueOnce([null, signedTxnStr2])

        const txnGroup = [txn1, txn2]
        const indexesToSign = [1]
        const returnGroup = false // Return only the signed transaction

        const expectedResult = [signedTxnEncoded2]

        const result = await wallet.signTransactions(txnGroup, indexesToSign, returnGroup)

        expect(result).toEqual(expectedResult)
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64'),
                signers: [] // txn1 should not be signed
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })

      it('should correctly merge signed transactions back into the original group', async () => {
        mockSignClient.request.mockResolvedValueOnce([null, signedTxnStr2])

        const txnGroup = [txn1, txn2]
        const returnGroup = true // Merge signed transaction back into original group

        // Only txn2 should be signed
        const indexesToSign1 = [1]
        const expectedResult1 = [algosdk.encodeUnsignedTransaction(txn1), signedTxnEncoded2]

        const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
        expect(result1).toEqual(expectedResult1)

        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, null])

        // Only txn1 should be signed
        const indexesToSign2 = [0]
        const expectedResult2 = [signedTxnEncoded1, algosdk.encodeUnsignedTransaction(txn2)]

        const result2 = await wallet.signTransactions(txnGroup, indexesToSign2, returnGroup)
        expect(result2).toEqual(expectedResult2)
      })

      it('should only send transactions with connected signers for signature', async () => {
        const txnCannotSign = new algosdk.Transaction({
          ...txnParams,
          from: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4', // EW64GC is not connected
          to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
          amount: 3000
        })

        mockSignClient.request.mockResolvedValueOnce([signedTxnStr1, null, signedTxnStr2])

        const result = await wallet.signTransactions([txn1, txnCannotSign, txn2])

        // expectedResult[1] should be original unsigned transaction
        const expectedResult = [
          signedTxnEncoded1,
          algosdk.encodeUnsignedTransaction(txnCannotSign),
          signedTxnEncoded2
        ]

        expect(result).toEqual(expectedResult)
        expect(mockSignClient.request).toHaveBeenCalledWith(
          createExpectedRpcRequest([
            [
              {
                txn: Buffer.from(txn1.toByte()).toString('base64')
              },
              {
                txn: Buffer.from(txnCannotSign.toByte()).toString('base64'),
                signers: [] // should not be signed
              },
              {
                txn: Buffer.from(txn2.toByte()).toString('base64')
              }
            ]
          ])
        )
      })
    })
  })
})
