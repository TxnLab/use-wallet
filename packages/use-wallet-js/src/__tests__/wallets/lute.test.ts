import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import LuteConnect from 'lute-connect'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { LuteWallet } from 'src/wallets/lute'
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
vi.spyOn(console, 'error').mockImplementation(() => {})
vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})

describe('LuteWallet', () => {
  let wallet: LuteWallet
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
    wallet = new LuteWallet({
      id: WalletId.LUTE,
      options: {
        siteName: 'Mock Site Name'
      },
      metadata: {},
      getAlgodClient: () =>
        ({
          genesis: () => ({
            do: () => Promise.resolve({ id: 'mockGenesisID', network: 'mockGenesisNetwork' })
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
    it('should initialize client, return account objects, and update store', async () => {
      const account1 = {
        name: 'Lute Wallet 1',
        address: 'mockAddress1'
      }
      const account2 = {
        name: 'Lute Wallet 2',
        address: 'mockAddress2'
      }

      const mockConnect = vi
        .fn()
        .mockImplementation(() => Promise.resolve([account1.address, account2.address]))

      vi.spyOn(LuteConnect.prototype, 'connect').mockImplementation(mockConnect)

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.LUTE]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should log an error and return an empty array when no accounts are found', async () => {
      const mockConnect = vi.fn().mockImplementation(() => Promise.resolve([]))

      vi.spyOn(LuteConnect.prototype, 'connect').mockImplementation(mockConnect)

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        '[LuteWallet] Error connecting: No accounts found!'
      )
      expect(accounts).toEqual([])
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      const mockConnect = vi.fn().mockImplementation(() => Promise.resolve(['mockAddress1']))

      vi.spyOn(LuteConnect.prototype, 'connect').mockImplementation(mockConnect)

      // Connect first to initialize client
      await wallet.connect()
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.LUTE]).toBeDefined()

      await wallet.disconnect()
      expect(wallet.isConnected).toBe(false)

      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    it('should be a no-op', async () => {
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
      await wallet.resumeSession()
      expect(store.state.wallets[WalletId.LUTE]).toBeUndefined()
    })
  })

  describe('signTransactions', () => {
    describe('when the client is not initialized', () => {
      it('should throw an error', async () => {
        await expect(wallet.signTransactions([])).rejects.toThrowError(
          '[LuteWallet] Client not initialized!'
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

      // Mock signed transaction
      const mockSignedTxn = new Uint8Array(Buffer.from('mockBase64SignedTxn', 'base64'))

      beforeEach(async () => {
        // Mock two connected accounts, 7ZUECA and GD64YI
        const mockConnect = vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve([
              '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
              'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
            ])
          )

        vi.spyOn(LuteConnect.prototype, 'connect').mockImplementation(mockConnect)

        await wallet.connect()
      })

      it('should log errors and re-throw to the consuming application', async () => {
        const signTxnsError = {
          code: 4001,
          message: 'User Rejected Request'
        }

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockRejectedValue(signTxnsError)

        try {
          // Signing transaction should fail
          await expect(wallet.signTransactions([txn1])).rejects.toThrowError()
        } catch (error: any) {
          expect(error).toEqual(signTxnsError)

          // Error message logged
          expect(console.error).toHaveBeenCalledWith(
            `[LuteWallet] Error signing transactions: ${signTxnsError.message} (code: ${signTxnsError.code})`
          )
        }
      })

      it('should correctly process and sign a single algosdk.Transaction', async () => {
        const mockSignTxns = vi.fn().mockImplementation(() => Promise.resolve([mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const result = await wallet.signTransactions([txn1])

        expect(result).toEqual([mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single algosdk.Transaction group', async () => {
        const mockSignTxns = vi
          .fn()
          .mockImplementation(() => Promise.resolve([mockSignedTxn, mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const result = await wallet.signTransactions(txnGroup)

        expect(result).toEqual([mockSignedTxn, mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign multiple algosdk.Transaction groups', async () => {
        const mockSignTxns = vi
          .fn()
          .mockImplementation(() => Promise.resolve([mockSignedTxn, mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup1 = algosdk.assignGroupID([txn1])
        const txnGroup2 = algosdk.assignGroupID([txn2])

        const result = await wallet.signTransactions([txnGroup1, txnGroup2])

        expect(result).toEqual([mockSignedTxn, mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single encoded transaction', async () => {
        const mockSignTxns = vi.fn().mockImplementation(() => Promise.resolve([mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const encodedTxn = txn1.toByte()
        const result = await wallet.signTransactions([encodedTxn])

        expect(result).toEqual([mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign a single encoded transaction group', async () => {
        const mockSignTxns = vi
          .fn()
          .mockImplementation(() => Promise.resolve([mockSignedTxn, mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

        const result = await wallet.signTransactions(encodedTxnGroup)

        expect(result).toEqual([mockSignedTxn, mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should correctly process and sign multiple encoded transaction groups', async () => {
        const mockSignTxns = vi
          .fn()
          .mockImplementation(() => Promise.resolve([mockSignedTxn, mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup1 = algosdk.assignGroupID([txn1])
        const encodedTxnGroup1 = txnGroup1.map((txn) => txn.toByte())

        const txnGroup2 = algosdk.assignGroupID([txn2])
        const encodedTxnGroup2 = txnGroup2.map((txn) => txn.toByte())

        const result = await wallet.signTransactions([encodedTxnGroup1, encodedTxnGroup2])

        expect(result).toEqual([mockSignedTxn, mockSignedTxn])
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txn1.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txn2.toByte()).toString('base64')
          }
        ])
      })

      it('should determine which transactions to sign based on indexesToSign', async () => {
        const mockSignTxns = vi.fn().mockImplementation(() => Promise.resolve([mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const indexesToSign = [1]
        const returnGroup = false // Return only the signed transaction

        const expectedResult = [mockSignedTxn]

        const result = await wallet.signTransactions(txnGroup, indexesToSign, returnGroup)

        expect(result).toEqual(expectedResult)
        expect(mockSignTxns).toHaveBeenCalledWith([
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
        const mockSignTxns = vi.fn().mockImplementation(() => Promise.resolve([mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        const txnGroup = algosdk.assignGroupID([txn1, txn2])
        const returnGroup = true // Merge signed transaction back into original group

        // Only txn2 should be signed
        const indexesToSign1 = [1]
        const expectedResult1 = [algosdk.encodeUnsignedTransaction(txnGroup[0]!), mockSignedTxn]

        const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
        expect(result1).toEqual(expectedResult1)

        // Only txn1 should be signed
        const indexesToSign2 = [0]
        const expectedResult2 = [mockSignedTxn, algosdk.encodeUnsignedTransaction(txnGroup[1]!)]

        const result2 = await wallet.signTransactions(txnGroup, indexesToSign2, returnGroup)
        expect(result2).toEqual(expectedResult2)
      })

      it('should only send transactions with connected signers for signature', async () => {
        // Connected accounts are 7ZUECA and GD64YI

        const txnCanSign1 = new algosdk.Transaction({
          ...txnParams,
          from: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
          to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
          amount: 1000
        })

        const txnCanSign2 = new algosdk.Transaction({
          ...txnParams,
          from: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
          to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
          amount: 2000
        })

        const txnCannotSign = new algosdk.Transaction({
          ...txnParams,
          from: 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4', // EW64GC is not connected
          to: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
          amount: 3000
        })

        const mockSignTxns = vi
          .fn()
          .mockImplementation(() => Promise.resolve([mockSignedTxn, mockSignedTxn]))

        vi.spyOn(LuteConnect.prototype, 'signTxns').mockImplementation(mockSignTxns)

        // txnGroup[1] can't be signed
        const txnGroup = algosdk.assignGroupID([txnCanSign1, txnCannotSign, txnCanSign2])

        // so expectedResult[1] should be original unsigned transaction
        const expectedResult = [
          mockSignedTxn,
          algosdk.encodeUnsignedTransaction(txnGroup[1]!),
          mockSignedTxn
        ]

        const result = await wallet.signTransactions(txnGroup)

        expect(result).toEqual(expectedResult)
        expect(mockSignTxns).toHaveBeenCalledWith([
          {
            txn: Buffer.from(txnGroup[0]!.toByte()).toString('base64')
          },
          {
            txn: Buffer.from(txnGroup[1]!.toByte()).toString('base64'),
            signers: [] // should not be signed
          },
          {
            txn: Buffer.from(txnGroup[2]!.toByte()).toString('base64')
          }
        ])
      })
    })
  })
})
