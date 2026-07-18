import algosdk from 'algosdk'
import { LuteAdapter } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import { byteArrayToBase64, ScopeType } from '@txnlab/use-wallet/adapter'
import type { AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'
import type { Mock } from 'vitest'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

interface MockLuteConnect {
  connect: Mock
  signTxns: Mock
  signData: Mock
  siteName: string
  forceWeb: boolean
  isExtensionInstalled: () => Promise<boolean>
}

let mockLuteConnect: MockLuteConnect

vi.mock('lute-connect', () => {
  return {
    default: vi.fn().mockImplementation(() => mockLuteConnect)
  }
})

const WALLET_ID = 'lute'

function createWallet(store: AdapterStoreAccessor): LuteAdapter {
  const wallet = new LuteAdapter({
    id: WALLET_ID,
    metadata: LuteAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any,
    options: {
      siteName: 'Mock Site Name'
    }
  })

  // @ts-expect-error - Mocking the private client property
  wallet.client = mockLuteConnect

  return wallet
}

describe('LuteAdapter', () => {
  let wallet: LuteAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

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

    mockLuteConnect = {
      connect: vi.fn(),
      signTxns: vi.fn(),
      signData: vi.fn(),
      siteName: 'Mock Site',
      forceWeb: false,
      isExtensionInstalled: vi.fn().mockResolvedValue(true)
    }

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
      mockLuteConnect.connect.mockResolvedValueOnce([account1.address, account2.address])

      const accounts = await wallet.connect()

      expect(mockLuteConnect.connect).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
      expect(accounts).toEqual([account1, account2])
      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [account1, account2],
        activeAccount: account1
      })
    })

    it('should throw an error if connection fails', async () => {
      mockLuteConnect.connect.mockRejectedValueOnce(new Error('Auth error'))

      await expect(wallet.connect()).rejects.toThrow('Auth error')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('should throw an error if an empty array is returned', async () => {
      mockLuteConnect.connect.mockResolvedValueOnce([])

      await expect(wallet.connect()).rejects.toThrow('No accounts found!')
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('should disconnect client and remove wallet from store', async () => {
      mockLuteConnect.connect.mockResolvedValueOnce([account1.address])

      await wallet.connect()
      await wallet.disconnect()

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

      await wallet.resumeSession()

      expect(wallet.isConnected).toBe(true)
      expect(store.state.wallets[WALLET_ID]).toEqual(walletState)
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
      mockLuteConnect.connect.mockResolvedValueOnce([connectedAcct1, connectedAcct2])

      await wallet.connect()
    })

    describe('signTransactions', () => {
      it('should re-throw SignTxnsError to the consuming application', async () => {
        const mockError = Object.assign(new Error('User Rejected Request'), { code: 4001 })
        mockLuteConnect.signTxns.mockRejectedValueOnce(mockError)

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

        // Mock signTxns to return "signed" encoded transactions or null
        mockLuteConnect.signTxns.mockResolvedValueOnce([
          gtxn1.toByte(),
          gtxn2.toByte(),
          null,
          gtxn4.toByte()
        ])

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
        const canSignTxn1 = makePayTxn({
          sender: connectedAcct1,
          amount: 1000
        })
        const cannotSignTxn2 = makePayTxn({
          sender: notConnectedAcct,
          amount: 2000
        })
        const canSignTxn3 = makePayTxn({
          sender: connectedAcct2,
          amount: 3000
        })

        const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([
          canSignTxn1,
          cannotSignTxn2,
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
    // Connected account
    const connectedAcct1 = '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'

    beforeEach(async () => {
      mockLuteConnect.connect.mockResolvedValueOnce([connectedAcct1])

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
      mockLuteConnect.signData.mockRejectedValueOnce(mockError)

      await expect(
        wallet.signData('test-data', {
          scope: ScopeType.AUTH,
          encoding: 'base64'
        })
      ).rejects.toMatchObject({
        name: 'SignDataError',
        message: 'User Rejected Request',
        code: 4300
      })
    })

    it('should handle sign and verify data flow', async () => {
      const siwaRequest = {
        account_address: connectedAcct1,
        chain_id: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
        domain: 'test.domain',
        'issued-at': new Date().toISOString(),
        type: 'ed25519',
        uri: 'https://test.domain',
        version: '1'
      }

      const data = btoa(JSON.stringify(siwaRequest))
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }

      const testAuthData = new Uint8Array(32).fill(1)
      const testSigner = new Uint8Array(algosdk.Address.fromString(connectedAcct1).publicKey)
      const testSignature = new Uint8Array(64).fill(9)

      const mockResponse = {
        data,
        signer: testSigner,
        domain: 'test.domain',
        authenticatorData: testAuthData,
        signature: testSignature
      }

      mockLuteConnect.signData.mockResolvedValue(mockResponse)

      const response = await wallet.signData(data, metadata)

      expect(response).toEqual(mockResponse)
      expect(mockLuteConnect.signData).toHaveBeenCalledWith(data, metadata)

      expect(response.data).toBeDefined()
      expect(response.signer).toBeDefined()
      expect(response.domain).toBeDefined()
      expect(response.authenticatorData).toBeDefined()
      expect(response.signature).toBeDefined()
    })
  })
})
