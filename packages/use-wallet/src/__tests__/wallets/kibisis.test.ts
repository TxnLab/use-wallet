import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import * as msgpack from 'algo-msgpack-with-bigint'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { WalletId } from 'src/wallets'
import * as Kibisis from 'src/wallets/kibisis'

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

// Constants
const TESTNET_GENESIS_HASH = Kibisis.ALGORAND_TESTNET_GENESIS_HASH
const ACCOUNT_1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
const ACCOUNT_2 = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'

/**
 * Mocks the two responses expected from a successful `connect` method call.
 * @param {Partial<Kibisis.EnableResult>} accountsResponse accounts returned by enable request
 */
function mockConnectResponses(accountsResponse: Partial<Kibisis.EnableResult>) {
  vi.spyOn(Kibisis.KibisisWallet, 'sendRequestWithTimeout')
    .mockReset()
    // First request (getProviders)
    .mockImplementationOnce(() =>
      Promise.resolve({
        networks: [
          {
            genesisHash: TESTNET_GENESIS_HASH,
            methods: ['enable', 'signTxns']
          }
        ]
      })
    )
    // Second request (enable)
    .mockImplementationOnce(() => Promise.resolve(accountsResponse))
}

/**
 * Mocks the two responses expected from a successful `signTransactions` method call.
 * @param {Partial<Kibisis.SignTxnsResult>} stxnsResponse signed transactions returned by signTxns request
 */
function mockSignTxnsResponses(stxnsResponse: Partial<Kibisis.SignTxnsResult>) {
  vi.spyOn(Kibisis.KibisisWallet, 'sendRequestWithTimeout')
    .mockReset()
    // First request (getProviders)
    .mockImplementationOnce(() =>
      Promise.resolve({
        networks: [
          {
            genesisHash: TESTNET_GENESIS_HASH,
            methods: ['enable', 'signTxns']
          }
        ]
      })
    )
    // Second request (signTxns)
    .mockImplementationOnce(() => Promise.resolve(stxnsResponse))
}

describe('KibisisWallet', () => {
  let wallet: Kibisis.KibisisWallet
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

    mockConnectResponses({
      accounts: [
        {
          name: 'Kibisis Wallet 1',
          address: ACCOUNT_1
        },
        {
          name: 'Kibisis Wallet 2',
          address: ACCOUNT_2
        }
      ]
    })

    store = new Store<State>(defaultState)
    wallet = new Kibisis.KibisisWallet({
      id: WalletId.KIBISIS,
      metadata: {},
      getAlgodClient: () =>
        ({
          versionsCheck: () => ({
            do: () => Promise.resolve({ genesis_hash_b64: TESTNET_GENESIS_HASH })
          })
        }) as any,
      store,
      subscribe: mockSubscribe
    })
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should call sendRequestWithTimeout with correct arguments', async () => {
      // Connect wallet
      await wallet.connect()

      // First call (getProviders)
      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith({
        method: 'getProviders',
        params: {
          providerId: Kibisis.ARC_0027_PROVIDER_ID
        },
        reference: Kibisis.ARC_0027_GET_PROVIDERS_REQUEST,
        timeout: Kibisis.LOWER_REQUEST_TIMEOUT
      })

      // Second call (enable)
      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith({
        method: 'enable',
        params: {
          genesisHash: TESTNET_GENESIS_HASH,
          providerId: Kibisis.ARC_0027_PROVIDER_ID
        },
        reference: Kibisis.ARC_0027_ENABLE_REQUEST
      })
    })

    it('should initialize client, return account objects, and update store', async () => {
      // Connect wallet
      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)

      // Accounts returned
      expect(accounts).toEqual([
        {
          name: 'Kibisis Wallet 1',
          address: ACCOUNT_1
        },
        {
          name: 'Kibisis Wallet 2',
          address: ACCOUNT_2
        }
      ])

      // Store updated
      expect(store.state.wallets[WalletId.KIBISIS]).toEqual({
        accounts: [
          {
            name: 'Kibisis Wallet 1',
            address: ACCOUNT_1
          },
          {
            name: 'Kibisis Wallet 2',
            address: ACCOUNT_2
          }
        ],
        activeAccount: {
          name: 'Kibisis Wallet 1',
          address: ACCOUNT_1
        }
      })
    })

    it('should handle errors gracefully', async () => {
      // Mock error response
      vi.spyOn(Kibisis.KibisisWallet, 'sendRequestWithTimeout').mockRejectedValue({
        code: Kibisis.NETWORK_NOT_SUPPORTED_ERROR,
        data: {
          genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8='
        },
        message: `Network "MAINNET" not supported on provider "KIBISIS"`,
        providerId: Kibisis.ARC_0027_PROVIDER_ID
      })

      // Connect wallet (should fail)
      const accounts = await wallet.connect()

      // Wallet is not connected
      expect(wallet.isConnected).toBe(false)

      // Error message logged
      expect(console.error).toHaveBeenCalledWith(
        `[KibisisWallet] Error connecting: Network "MAINNET" not supported on provider "KIBISIS"`
      )

      // No accounts returned
      expect(accounts).toEqual([])

      // Store not updated
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      // Connect wallet
      await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.KIBISIS]).toBeDefined()

      // Disconnect wallet
      await wallet.disconnect()

      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should be a no-op', async () => {
      // Initial state
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()

      // Resume session
      await wallet.resumeSession()

      // No change to store
      expect(store.state.wallets[WalletId.KIBISIS]).toBeUndefined()
    })
  })

  describe('signTransactions', () => {
    const txnParams = {
      fee: 10,
      firstRound: 51,
      lastRound: 61,
      genesisHash: TESTNET_GENESIS_HASH,
      genesisID: 'testnet-v1.0'
    }

    // Transactions used in tests
    const txn1 = new algosdk.Transaction({
      ...txnParams,
      from: ACCOUNT_1,
      to: ACCOUNT_1,
      amount: 1000
    })
    const txn2 = new algosdk.Transaction({
      ...txnParams,
      from: ACCOUNT_1,
      to: ACCOUNT_1,
      amount: 2000
    })

    // Signed transactions
    const signedTxn1 = {
      txn: Buffer.from(txn1.toByte()).toString('base64'),
      sig: 'mockBase64Signature'
    }
    const signedTxn2 = {
      txn: Buffer.from(txn2.toByte()).toString('base64'),
      sig: 'mockBase64Signature'
    }

    // Signed transactions (base64 strings) returned by Kibisis
    const signedTxnStr1 = Buffer.from(
      new Uint8Array(msgpack.encode(signedTxn1, { sortKeys: true }))
    ).toString('base64')
    const signedTxnStr2 = Buffer.from(
      new Uint8Array(msgpack.encode(signedTxn2, { sortKeys: true }))
    ).toString('base64')

    // Signed transactions (Uint8Array) returned by use-wallet
    const signedTxnEncoded1 = new Uint8Array(Buffer.from(signedTxnStr1, 'base64'))
    const signedTxnEncoded2 = new Uint8Array(Buffer.from(signedTxnStr2, 'base64'))

    // Expected arguments for signTxns request
    function expectedSignTxnsArgs(txns: Kibisis.Arc0001SignTxns[]) {
      return {
        method: 'signTxns',
        params: {
          providerId: Kibisis.ARC_0027_PROVIDER_ID,
          txns
        },
        reference: Kibisis.ARC_0027_SIGN_TXNS_REQUEST
      }
    }

    beforeEach(async () => {
      await wallet.connect()
    })

    it('should call sendRequestWithTimeout with correct arguments', async () => {
      // Mock sendRequestWithTimeout responses
      mockSignTxnsResponses({ stxns: [signedTxnStr1] })

      // Sign transaction
      await wallet.signTransactions([txn1])

      // First call (getProviders)
      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith({
        method: 'getProviders',
        params: {
          providerId: Kibisis.ARC_0027_PROVIDER_ID
        },
        reference: Kibisis.ARC_0027_GET_PROVIDERS_REQUEST,
        timeout: Kibisis.LOWER_REQUEST_TIMEOUT
      })

      // Second call (signTxns)
      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith({
        method: 'signTxns',
        params: {
          providerId: Kibisis.ARC_0027_PROVIDER_ID,
          txns: [
            {
              txn: Buffer.from(txn1.toByte()).toString('base64')
            }
          ]
        },
        reference: Kibisis.ARC_0027_SIGN_TXNS_REQUEST
      })
    })

    it('should log errors and re-throw to the consuming application', async () => {
      // Mock getProviders response
      vi.spyOn(Kibisis.KibisisWallet, 'sendRequestWithTimeout')
        .mockReset()
        .mockImplementationOnce(() =>
          Promise.resolve({
            networks: [
              {
                genesisHash: TESTNET_GENESIS_HASH,
                methods: ['enable', 'signTxns']
              }
            ]
          })
        )

      // Mock signTxns error response
      const responseError: Kibisis.ResponseError = {
        code: Kibisis.METHOD_CANCELED_ERROR,
        data: undefined,
        message: `Signing was canceled by the user`,
        providerId: Kibisis.ARC_0027_PROVIDER_ID
      }

      // Mock signTxns error response
      vi.spyOn(Kibisis.KibisisWallet, 'sendRequestWithTimeout').mockRejectedValue(responseError)

      try {
        // Signing transaction should fail
        await expect(wallet.signTransactions([txn1])).rejects.toThrowError()
      } catch (error: any) {
        expect(error).toEqual(responseError)

        // Error message logged
        expect(console.error).toHaveBeenCalledWith(
          `[KibisisWallet] Error signing transactions: ${responseError.message} (code: ${responseError.code})`
        )
      }
    })

    it('should correctly process and sign a single algosdk.Transaction', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1] })

      const result = await wallet.signTransactions([txn1])

      expect(result).toEqual([signedTxnEncoded1])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly process and sign a single algosdk.Transaction group', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1, signedTxnStr2] })

      const result = await wallet.signTransactions([txn1, txn2])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly process and sign multiple algosdk.Transaction groups', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1, signedTxnStr2] })

      const result = await wallet.signTransactions([[txn1], [txn2]])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly process and sign a single encoded transaction', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1] })

      const encodedTxn = txn1.toByte()
      const result = await wallet.signTransactions([encodedTxn])

      expect(result).toEqual([signedTxnEncoded1])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly process and sign a single encoded transaction group', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1, signedTxnStr2] })

      const txnGroup = [txn1, txn2]
      const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

      const result = await wallet.signTransactions(encodedTxnGroup)

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly process and sign multiple encoded transaction groups', async () => {
      mockSignTxnsResponses({ stxns: [signedTxnStr1, signedTxnStr2] })

      const result = await wallet.signTransactions([[txn1.toByte()], [txn2.toByte()]])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should determine which transactions to sign based on indexesToSign', async () => {
      mockSignTxnsResponses({ stxns: [null, signedTxnStr2] })

      const txnGroup = [txn1, txn2]
      const indexesToSign = [1] // Only sign txn2
      const returnGroup = false // Return only the signed transaction

      const expectedResult = [signedTxnEncoded2]

      const result = await wallet.signTransactions(txnGroup, indexesToSign, returnGroup)

      expect(result).toEqual(expectedResult)

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64'),
            signers: [] // txn1 should not be signed
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })

    it('should correctly merge signed transactions back into the original group', async () => {
      mockSignTxnsResponses({ stxns: [null, signedTxnStr2] })

      const txnGroup = [txn1, txn2]
      const returnGroup = true // Merge signed transaction back into original group

      // Only txn2 should be signed
      const indexesToSign1 = [1]
      const expectedResult1 = [algosdk.encodeUnsignedTransaction(txn1), signedTxnEncoded2]

      const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
      expect(result1).toEqual(expectedResult1)

      mockSignTxnsResponses({ stxns: [signedTxnStr1, null] })

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

      mockSignTxnsResponses({ stxns: [signedTxnStr1, null, signedTxnStr2] })

      const result = await wallet.signTransactions([txn1, txnCannotSign, txn2])

      // expectedResult[1] should be original unsigned transaction
      const expectedResult = [
        signedTxnEncoded1,
        algosdk.encodeUnsignedTransaction(txnCannotSign),
        signedTxnEncoded2
      ]

      expect(result).toEqual(expectedResult)

      expect(Kibisis.KibisisWallet.sendRequestWithTimeout).toHaveBeenCalledWith(
        expectedSignTxnsArgs([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txnCannotSign.toByte()).toString('base64'),
            signers: [] // txnCannotSign should not be signed
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      )
    })
  })
})
