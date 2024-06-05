import { Store } from '@tanstack/store'
import * as msgpack from 'algo-msgpack-with-bigint'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { MagicAuth } from 'src/wallets/magic'
import { WalletId } from 'src/wallets/types'

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
vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

const mockMagicClient = {
  auth: {
    loginWithMagicLink: vi.fn().mockImplementation(() => Promise.resolve())
  },
  user: {
    getInfo: vi.fn(),
    logout: vi.fn(),
    isLoggedIn: vi.fn()
  },
  algorand: {
    signGroupTransactionV2: vi.fn()
  }
}

vi.mock('magic-sdk', () => {
  return {
    Magic: vi.fn().mockImplementation(() => mockMagicClient)
  }
})

describe('MagicAuth', () => {
  let wallet: MagicAuth
  let store: Store<State>
  let mockInitialState: State | null = null

  const email = 'test@example.com'
  const publicAddress = 'mockAddress'

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
    wallet = new MagicAuth({
      id: WalletId.MAGIC,
      options: {
        apiKey: 'mock-api-key'
      },
      metadata: {},
      getAlgodClient: {} as any,
      store,
      subscribe: mockSubscribe
    })
  })

  afterEach(async () => {
    await wallet.disconnect()
    mockInitialState = null
  })

  describe('connect', () => {
    it('should initialize client, auth, return account object, and update store', async () => {
      const account = {
        name: email,
        address: publicAddress
      }

      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })

      const result = await wallet.connect({ email })

      expect(mockMagicClient.auth.loginWithMagicLink).toHaveBeenCalledWith({ email })
      expect(wallet.isConnected).toBe(true)
      expect(result).toEqual([account])
      expect(store.state.wallets[WalletId.MAGIC]).toEqual({
        accounts: [account],
        activeAccount: account
      })
    })

    it('should throw an error if email is missing', async () => {
      await expect(wallet.connect()).rejects.toThrow(
        'Magic Link provider requires an email (string) to connect'
      )
    })

    it('should throw an error if loginWithMagicLink fails', async () => {
      mockMagicClient.auth.loginWithMagicLink.mockRejectedValueOnce(new Error('Auth error'))
      await expect(wallet.connect({ email })).rejects.toThrow('Auth error')
    })

    it('should throw an error if getInfo fails', async () => {
      mockMagicClient.user.getInfo.mockRejectedValueOnce(new Error('Get info error'))
      await expect(wallet.connect({ email })).rejects.toThrow('Get info error')
    })

    it('should throw an error if user info does not contain an address', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce(undefined)
      await expect(wallet.connect({ email })).rejects.toThrow('User info not found!')
    })

    it('should throw an error if user info does not contain an address', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email })
      await expect(wallet.connect({ email })).rejects.toThrow('No account found!')
    })
  })

  describe('disconnect', () => {
    it('should log out user and update store', async () => {
      mockMagicClient.user.getInfo.mockResolvedValueOnce({ email, publicAddress })

      await wallet.connect({ email })
      await wallet.disconnect()

      expect(mockMagicClient.user.logout).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MAGIC]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session is found', async () => {
      await wallet.resumeSession()

      expect(mockMagicClient.user.getInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
    })

    it('should disconnect if user is not logged in', async () => {
      const walletState: WalletState = {
        accounts: [
          {
            name: email,
            address: publicAddress
          }
        ],
        activeAccount: {
          name: email,
          address: publicAddress
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = new MagicAuth({
        id: WalletId.MAGIC,
        options: {
          apiKey: 'mock-api-key'
        },
        metadata: {},
        getAlgodClient: {} as any,
        store,
        subscribe: mockSubscribe
      })

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(false)
      await wallet.resumeSession()

      expect(mockMagicClient.user.isLoggedIn).toHaveBeenCalled()
      expect(mockMagicClient.user.getInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WalletId.MAGIC]).toBeUndefined()
    })

    it('should resume session if session is found', async () => {
      const walletState: WalletState = {
        accounts: [
          {
            name: email,
            address: publicAddress
          }
        ],
        activeAccount: {
          name: email,
          address: publicAddress
        }
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = new MagicAuth({
        id: WalletId.MAGIC,
        options: {
          apiKey: 'mock-api-key'
        },
        metadata: {},
        getAlgodClient: {} as any,
        store,
        subscribe: mockSubscribe
      })

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(true)
      await wallet.resumeSession()

      expect(mockMagicClient.user.isLoggedIn).toHaveBeenCalled()
      expect(mockMagicClient.user.getInfo).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.MAGIC]).toEqual(walletState)
    })

    it('should update the store if the user info does not match the stored account', async () => {
      const prevAccount = {
        name: 'foo@example.com',
        address: 'mockAddress1'
      }

      const newAccount = {
        name: 'bar@example.com',
        address: 'mockAddress2'
      }

      const walletState: WalletState = {
        accounts: [prevAccount],
        activeAccount: prevAccount
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.MAGIC]: walletState
        }
      })

      wallet = new MagicAuth({
        id: WalletId.MAGIC,
        options: {
          apiKey: 'mock-api-key'
        },
        metadata: {},
        getAlgodClient: {} as any,
        store,
        subscribe: mockSubscribe
      })

      mockMagicClient.user.isLoggedIn.mockResolvedValueOnce(true)
      mockMagicClient.user.getInfo.mockResolvedValueOnce({
        email: newAccount.name,
        publicAddress: newAccount.address
      })
      await wallet.resumeSession()

      expect(console.warn).toHaveBeenCalledWith(
        '[Magic] Session account mismatch, updating account',
        {
          prev: prevAccount,
          current: newAccount
        }
      )

      expect(store.state.wallets[WalletId.MAGIC]).toEqual({
        accounts: [newAccount],
        activeAccount: newAccount
      })
    })
  })

  describe('signTransactions', () => {
    it('should throw an error if client is not initialized', async () => {
      await expect(wallet.signTransactions([])).rejects.toThrow('[Magic] Client not initialized!')
    })

    describe('with client initialized', () => {
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

      // Signed transactions (base64 strings) returned by Magic client
      const signedTxnStr1 = Buffer.from(
        new Uint8Array(msgpack.encode(signedTxnObj1, { sortKeys: true }))
      ).toString('base64')
      const signedTxnStr2 = Buffer.from(
        new Uint8Array(msgpack.encode(signedTxnObj2, { sortKeys: true }))
      ).toString('base64')

      // Signed transactions (Uint8Array) returned by MagicAuth.signTransactions
      const signedTxnEncoded1 = new Uint8Array(Buffer.from(signedTxnStr1, 'base64'))
      const signedTxnEncoded2 = new Uint8Array(Buffer.from(signedTxnStr2, 'base64'))

      beforeEach(async () => {
        mockMagicClient.user.getInfo.mockResolvedValueOnce({
          email,
          publicAddress: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
        })
        await wallet.connect({ email })
      })

      it('should correctly process and sign a single algosdk.Transaction', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([signedTxnStr1])

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([signedTxnEncoded1])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          signedTxnStr1,
          signedTxnStr2
        ])

        const result = await wallet.signTransactions([txn1, txn2])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign multiple algosdk.Transaction groups', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          signedTxnStr1,
          signedTxnStr2
        ])

        const result = await wallet.signTransactions([[txn1], [txn2]])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([signedTxnStr1])

        const encodedTxn = txn1.toByte()
        const result = await wallet.signTransactions([encodedTxn])

        expect(result).toEqual([signedTxnEncoded1])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          signedTxnStr1,
          signedTxnStr2
        ])

        const txnGroup = [txn1, txn2]
        const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

        const result = await wallet.signTransactions(encodedTxnGroup)

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign multiple encoded transaction groups', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          signedTxnStr1,
          signedTxnStr2
        ])

        const result = await wallet.signTransactions([[txn1.toByte()], [txn2.toByte()]])

        expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([null, signedTxnStr2])

        const txnGroup = [txn1, txn2]
        const indexesToSign = [1]
        const returnGroup = false // Return only the signed transaction

        const expectedResult = [signedTxnEncoded2]

        const result = await wallet.signTransactions(txnGroup, indexesToSign, returnGroup)

        expect(result).toEqual(expectedResult)
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64'),
            signers: [] // txn1 should not be signed
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly merge signed transactions back into the original group', async () => {
        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([null, signedTxnStr2])

        const txnGroup = [txn1, txn2]
        const returnGroup = true // Merge signed transaction back into original group

        // Only txn2 should be signed
        const indexesToSign1 = [1]
        const expectedResult1 = [algosdk.encodeUnsignedTransaction(txn1), signedTxnEncoded2]

        const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
        expect(result1).toEqual(expectedResult1)

        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([signedTxnStr1, null])

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

        mockMagicClient.algorand.signGroupTransactionV2.mockResolvedValueOnce([
          signedTxnStr1,
          null,
          signedTxnStr2
        ])

        const result = await wallet.signTransactions([txn1, txnCannotSign, txn2])

        // expectedResult[1] should be original unsigned transaction
        const expectedResult = [
          signedTxnEncoded1,
          algosdk.encodeUnsignedTransaction(txnCannotSign),
          signedTxnEncoded2
        ]

        expect(result).toEqual(expectedResult)
        expect(mockMagicClient.algorand.signGroupTransactionV2).toHaveBeenCalledWith([
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
        ])
      })
    })
  })
})
