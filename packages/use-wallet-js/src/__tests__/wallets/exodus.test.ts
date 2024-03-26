import { Store } from '@tanstack/store'
import * as msgpack from 'algo-msgpack-with-bigint'
import algosdk from 'algosdk'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { Exodus, ExodusWallet } from 'src/wallets/exodus'
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

const mockEnableFn = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    genesisID: 'mainnet-v1.0',
    genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
    accounts: [
      '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
      'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
    ]
  })
})

const mockSignTxns = vi.fn().mockResolvedValue(['mockBase64SignedTxn'])

// Mock Exodus extension
const mockExodus: Exodus = {
  isConnected: true,
  address: 'mock-address',
  enable: mockEnableFn,
  signTxns: mockSignTxns
}

Object.defineProperties(global, {
  window: {
    value: {
      algorand: mockExodus
    }
  }
})

describe('ExodusWallet', () => {
  let wallet: ExodusWallet
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
    wallet = new ExodusWallet({
      id: WalletId.EXODUS,
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
        name: 'Exodus Wallet 1',
        address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
      }
      const account2 = {
        name: 'Exodus Wallet 2',
        address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
      }

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WalletId.EXODUS]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should log an error and return an empty array when no accounts are found', async () => {
      mockEnableFn.mockResolvedValueOnce({
        genesisID: 'mainnet-v1.0',
        genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        accounts: []
      })

      const accounts = await wallet.connect()

      expect(wallet.isConnected).toBe(false)
      expect(console.error).toHaveBeenCalledWith(
        '[ExodusWallet] Error connecting: No accounts found!'
      )
      expect(accounts).toEqual([])
      expect(store.state.wallets[WalletId.EXODUS]).toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      // Connect first to initialize client
      await wallet.connect()
      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WalletId.EXODUS]).toBeDefined()

      await wallet.disconnect()
      expect(wallet.isConnected).toBe(false)

      expect(store.state.wallets[WalletId.EXODUS]).toBeUndefined()
    })
  })

  describe('resumeSession', () => {
    describe('when there is Exodus wallet data in the store', () => {
      beforeEach(() => {
        const account1 = {
          name: 'Exodus Wallet 1',
          address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
        }
        const account2 = {
          name: 'Exodus Wallet 2',
          address: 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
        }

        store = new Store<State>({
          ...defaultState,
          wallets: {
            [WalletId.EXODUS]: {
              accounts: [account1, account2],
              activeAccount: account1
            }
          }
        })

        wallet = new ExodusWallet({
          id: WalletId.EXODUS,
          metadata: {},
          getAlgodClient: () => ({}) as any,
          store,
          subscribe: mockSubscribe
        })
      })

      describe('when the Exodus extension is connected', () => {
        it('should be a no-op', async () => {
          expect(store.state.wallets[WalletId.EXODUS]).toBeDefined()
          await wallet.resumeSession()
          expect(store.state.wallets[WalletId.EXODUS]).toBeDefined()
        })
      })

      describe('when the Exodus extension is not connected', () => {
        beforeEach(() => {
          // @ts-expect-error - algorand does not exist on window
          window.algorand.isConnected = false
        })

        it('should remove the wallet from the store if the extension is not found', async () => {
          expect(store.state.wallets[WalletId.EXODUS]).toBeDefined()
          await wallet.resumeSession()
          expect(store.state.wallets[WalletId.EXODUS]).toBeUndefined()
        })

        afterEach(() => {
          // @ts-expect-error - algorand does not exist on window
          window.algorand.isConnected = true
        })
      })
    })

    describe('when there is no Exodus wallet data in the store', () => {
      it('should be a no-op', async () => {
        expect(store.state.wallets[WalletId.EXODUS]).toBeUndefined()
        await wallet.resumeSession()
        expect(store.state.wallets[WalletId.EXODUS]).toBeUndefined()
      })
    })
  })

  describe('signTransactions', () => {
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

    beforeEach(async () => {
      await wallet.connect()
    })

    it('should correctly process and sign a single algosdk.Transaction', async () => {
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1])

      const result = await wallet.signTransactions([txn1])

      expect(result).toEqual([signedTxnEncoded1])
      expect(mockSignTxns).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign a single algosdk.Transaction group', async () => {
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

      const result = await wallet.signTransactions([txn1, txn2])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
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
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

      const result = await wallet.signTransactions([[txn1], [txn2]])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
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
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1])

      const encodedTxn = txn1.toByte()
      const result = await wallet.signTransactions([encodedTxn])

      expect(result).toEqual([signedTxnEncoded1])
      expect(mockSignTxns).toHaveBeenCalledWith([
        {
          txn: Buffer.from(txn1.toByte()).toString('base64')
        }
      ])
    })

    it('should correctly process and sign a single encoded transaction group', async () => {
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const encodedTxnGroup = txnGroup.map((txn) => txn.toByte())

      const result = await wallet.signTransactions(encodedTxnGroup)

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
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
      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, signedTxnStr2])

      const result = await wallet.signTransactions([[txn1.toByte()], [txn2.toByte()]])

      expect(result).toEqual([signedTxnEncoded1, signedTxnEncoded2])
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
      mockSignTxns.mockResolvedValueOnce([null, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const indexesToSign = [1]
      const returnGroup = false // Return only the signed transaction

      const expectedResult = [signedTxnEncoded2]

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
      mockSignTxns.mockResolvedValueOnce([null, signedTxnStr2])

      const txnGroup = [txn1, txn2]
      const returnGroup = true // Merge signed transaction back into original group

      // Only txn2 should be signed
      const indexesToSign1 = [1]
      const expectedResult1 = [algosdk.encodeUnsignedTransaction(txn1), signedTxnEncoded2]

      const result1 = await wallet.signTransactions(txnGroup, indexesToSign1, returnGroup)
      expect(result1).toEqual(expectedResult1)

      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, null])

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

      mockSignTxns.mockResolvedValueOnce([signedTxnStr1, null, signedTxnStr2])

      const result = await wallet.signTransactions([txn1, txnCannotSign, txn2])

      // expectedResult[1] should be original unsigned transaction
      const expectedResult = [
        signedTxnEncoded1,
        algosdk.encodeUnsignedTransaction(txnCannotSign),
        signedTxnEncoded2
      ]

      expect(result).toEqual(expectedResult)
      expect(mockSignTxns).toHaveBeenCalledWith([
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
