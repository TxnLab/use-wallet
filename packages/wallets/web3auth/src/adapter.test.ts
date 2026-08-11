import algosdk from 'algosdk'
import { Web3AuthAdapter } from './adapter'
import { createTestHarness, type WalletState } from '@txnlab/use-wallet/testing'
import type { AdapterStoreAccessor } from '@txnlab/use-wallet/adapter'
import type { State, Store } from '@txnlab/use-wallet/testing'

vi.mock('@txnlab/use-wallet/adapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@txnlab/use-wallet/adapter')>()
  return {
    ...original,
    LogLevel: original.LogLevel
  }
})

// Generate a test key pair for mocking
// This is a deterministic test key - DO NOT use in production
const TEST_PRIVATE_KEY_HEX = 'a'.repeat(64) // 32 bytes as hex (64 chars)

// Mock Web3Auth provider (shared between modal and SFA)
const mockWeb3AuthProvider = {
  request: vi.fn()
}

// Mock Web3Auth Modal client (v10: initModal() replaced by init())
const mockWeb3Auth = {
  init: vi.fn(),
  connect: vi.fn(),
  logout: vi.fn(),
  connected: false,
  provider: null as typeof mockWeb3AuthProvider | null,
  getUserInfo: vi.fn()
}

// Mock Web3Auth Single Factor Auth client
const mockWeb3AuthSFA = {
  init: vi.fn(),
  connect: vi.fn(),
  logout: vi.fn(),
  connected: false,
  provider: null as typeof mockWeb3AuthProvider | null
}

vi.mock('@web3auth/modal', () => ({
  Web3Auth: vi.fn(() => mockWeb3Auth),
  WEB3AUTH_NETWORK: {
    MAINNET: 'mainnet',
    TESTNET: 'testnet',
    SAPPHIRE_MAINNET: 'sapphire_mainnet',
    SAPPHIRE_DEVNET: 'sapphire_devnet',
    CYAN: 'cyan',
    AQUA: 'aqua'
  }
}))

vi.mock('@web3auth/single-factor-auth', () => ({
  Web3Auth: vi.fn(() => mockWeb3AuthSFA)
}))

vi.mock('@web3auth/base-provider', () => ({
  CommonPrivateKeyProvider: vi.fn(() => ({}))
}))

const WALLET_ID = 'web3auth'

// Pre-computed address derived from TEST_PRIVATE_KEY_HEX using tweetnacl
// This avoids needing async in the test setup
const TEST_ADDRESS = '442OU3BLMJL544RVLZDSVIC2JREH422GHQBJ5UYG34XQDNLDNNMHEHK46Y'

function createWallet(
  store: AdapterStoreAccessor,
  options?: Record<string, unknown>
): Web3AuthAdapter {
  return new Web3AuthAdapter({
    id: WALLET_ID,
    metadata: Web3AuthAdapter.defaultMetadata,
    store,
    subscribe: vi.fn(),
    getAlgodClient: () => ({}) as any,
    options: {
      clientId: 'mock-client-id',
      ...options
    }
  })
}

describe('Web3AuthAdapter', () => {
  let wallet: Web3AuthAdapter
  let store: Store<State>
  let accessor: AdapterStoreAccessor

  const LOCAL_STORAGE_WEB3AUTH_KEY = '@txnlab/use-wallet:v5:web3auth'

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock Web3Auth Modal state
    mockWeb3Auth.connected = false
    mockWeb3Auth.provider = null
    mockWeb3Auth.init.mockResolvedValue(undefined)
    mockWeb3Auth.connect.mockImplementation(async () => {
      mockWeb3Auth.connected = true
      mockWeb3Auth.provider = mockWeb3AuthProvider
      return mockWeb3AuthProvider
    })
    mockWeb3Auth.logout.mockResolvedValue(undefined)
    mockWeb3Auth.getUserInfo.mockResolvedValue({ email: 'test@example.com' })

    // Reset mock Web3Auth SFA state
    mockWeb3AuthSFA.connected = false
    mockWeb3AuthSFA.provider = null
    mockWeb3AuthSFA.init.mockResolvedValue(undefined)
    mockWeb3AuthSFA.connect.mockImplementation(async () => {
      mockWeb3AuthSFA.connected = true
      mockWeb3AuthSFA.provider = mockWeb3AuthProvider
      return mockWeb3AuthProvider
    })
    mockWeb3AuthSFA.logout.mockResolvedValue(undefined)

    // Common provider mock
    mockWeb3AuthProvider.request.mockResolvedValue(TEST_PRIVATE_KEY_HEX)

    // Mock localStorage
    const localStorageStore: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key]
      })
    })

    const harness = createTestHarness(WALLET_ID)
    store = harness.store
    accessor = harness.accessor

    wallet = createWallet(accessor)
  })

  afterEach(async () => {
    try {
      await wallet.disconnect()
    } catch {
      // Ignore disconnect errors in cleanup
    }
    vi.unstubAllGlobals()
  })

  describe('constructor', () => {
    it('should throw error if clientId is missing', () => {
      expect(
        () =>
          new Web3AuthAdapter({
            id: WALLET_ID,
            metadata: Web3AuthAdapter.defaultMetadata,
            store: accessor,
            subscribe: vi.fn(),
            getAlgodClient: () => ({}) as any,
            options: {} as any
          })
      ).toThrow('Missing required option: clientId')
    })
  })

  describe('connect', () => {
    it('should initialize client, authenticate, and return account', async () => {
      const result = await wallet.connect()

      expect(mockWeb3Auth.init).toHaveBeenCalled()
      expect(mockWeb3Auth.connect).toHaveBeenCalled()
      expect(mockWeb3Auth.getUserInfo).toHaveBeenCalled()
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledWith({ method: 'private_key' })

      expect(wallet.isConnected).toBe(true)
      expect(result.length).toBe(1)
      expect(result[0].address).toBe(TEST_ADDRESS)

      expect(store.state.wallets[WALLET_ID]).toEqual({
        accounts: [{ name: 'test@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'test@example.com', address: TEST_ADDRESS }
      })
    })

    it('should use name from user info if available', async () => {
      mockWeb3Auth.getUserInfo.mockResolvedValueOnce({
        name: 'Test User',
        email: 'test@example.com'
      })

      const result = await wallet.connect()

      expect(result[0].name).toBe('Test User')
    })

    it('should throw error if connect fails', async () => {
      mockWeb3Auth.connect.mockResolvedValueOnce(null)

      await expect(wallet.connect()).rejects.toThrow('Failed to connect to Web3Auth')
    })

    it('should throw error if private key retrieval fails', async () => {
      mockWeb3AuthProvider.request.mockResolvedValueOnce(null)

      await expect(wallet.connect()).rejects.toThrow('Failed to retrieve private key from Web3Auth')
    })

    it('should support custom authentication with idToken and verifierId', async () => {
      const customAuth = {
        idToken: 'mock-firebase-id-token',
        verifierId: 'user@example.com',
        verifier: 'my-firebase-verifier'
      }

      const result = await wallet.connect(customAuth)

      // Should use SFA SDK for custom JWT auth (no modal)
      expect(mockWeb3AuthSFA.init).toHaveBeenCalled()
      expect(mockWeb3AuthSFA.connect).toHaveBeenCalledWith({
        verifier: 'my-firebase-verifier',
        verifierId: 'user@example.com',
        idToken: 'mock-firebase-id-token'
      })
      expect(result.length).toBe(1)
      expect(result[0].address).toBe(TEST_ADDRESS)
    })

    it('should throw error if custom auth is missing verifier', async () => {
      const customAuth = {
        idToken: 'mock-token',
        verifierId: 'user@example.com'
        // no verifier provided
      }

      await expect(wallet.connect(customAuth)).rejects.toThrow(
        'Custom authentication requires a verifier'
      )
    })

    it('should use options.verifier as default for custom auth', async () => {
      // Create wallet with default verifier in options
      const walletWithVerifier = createWallet(accessor, {
        clientId: 'mock-client-id',
        verifier: 'default-verifier'
      })

      const customAuth = {
        idToken: 'mock-token',
        verifierId: 'user@example.com'
        // verifier not provided, should use default
      }

      await walletWithVerifier.connect(customAuth)

      // Should use SFA SDK with the default verifier from options
      expect(mockWeb3AuthSFA.connect).toHaveBeenCalledWith({
        verifier: 'default-verifier',
        verifierId: 'user@example.com',
        idToken: 'mock-token'
      })

      await walletWithVerifier.disconnect()
    })
  })

  describe('disconnect', () => {
    it('should logout and clear state', async () => {
      await wallet.connect()
      await wallet.disconnect()

      expect(mockWeb3Auth.logout).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })

    it('should handle logout errors gracefully', async () => {
      await wallet.connect()
      mockWeb3Auth.logout.mockRejectedValueOnce(new Error('Logout failed'))

      // Should not throw, just warn
      await expect(wallet.disconnect()).resolves.not.toThrow()
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('resumeSession', () => {
    it('should do nothing if no session exists', async () => {
      await wallet.resumeSession()

      // Lazy mode: We don't touch Web3Auth during resume
      expect(mockWeb3Auth.getUserInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
    })

    it('should restore cached address without checking Web3Auth (lazy mode)', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'test@example.com', address: TEST_ADDRESS }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      // Web3Auth not connected - but that's okay for lazy resume
      mockWeb3Auth.connected = false
      mockWeb3Auth.provider = null

      await wallet.resumeSession()

      // Lazy mode: Wallet should still be "connected" using cached address
      // Web3Auth session check happens later at sign time
      expect(mockWeb3Auth.getUserInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
      expect(wallet.activeAddress).toBe(TEST_ADDRESS)
    })

    it('should disconnect if cached session has no address', async () => {
      const walletState: WalletState = {
        accounts: [],
        activeAccount: null
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store
      wallet = createWallet(harness.accessor)

      await wallet.resumeSession()

      expect(store.state.wallets[WALLET_ID]).toBeUndefined()
    })
  })

  describe('signTransactions', () => {
    const connectedAddress = TEST_ADDRESS

    const makePayTxn = ({
      amount = 1000,
      sender = connectedAddress,
      receiver = connectedAddress
    }) => {
      return new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver, amount }
      })
    }

    beforeEach(async () => {
      await wallet.connect()
    })

    it('should sign a single transaction', async () => {
      const txn = makePayTxn({ amount: 1000 })

      const result = await wallet.signTransactions([txn])

      expect(result.length).toBe(1)
      expect(result[0]).toBeInstanceOf(Uint8Array)

      // Verify the signed transaction is valid
      const decoded = algosdk.decodeSignedTransaction(result[0]!)
      expect(decoded.txn.sender.toString()).toBe(connectedAddress)
    })

    it('should sign multiple transactions', async () => {
      const txn1 = makePayTxn({ amount: 1000 })
      const txn2 = makePayTxn({ amount: 2000 })
      const [gtxn1, gtxn2] = algosdk.assignGroupID([txn1, txn2])

      const result = await wallet.signTransactions([gtxn1, gtxn2])

      expect(result.length).toBe(2)
      expect(result[0]).toBeInstanceOf(Uint8Array)
      expect(result[1]).toBeInstanceOf(Uint8Array)
    })

    it('should only sign transactions for connected address', async () => {
      const otherAddress = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'

      const txn1 = makePayTxn({ sender: connectedAddress, amount: 1000 })
      const txn2 = makePayTxn({ sender: otherAddress, amount: 2000 })
      const [gtxn1, gtxn2] = algosdk.assignGroupID([txn1, txn2])

      const result = await wallet.signTransactions([gtxn1, gtxn2])

      // Should only return signed txn for connected address
      expect(result.length).toBe(1)
    })

    it('should respect indexesToSign parameter', async () => {
      const txn1 = makePayTxn({ amount: 1000 })
      const txn2 = makePayTxn({ amount: 2000 })
      const txn3 = makePayTxn({ amount: 3000 })
      const [gtxn1, gtxn2, gtxn3] = algosdk.assignGroupID([txn1, txn2, txn3])

      const result = await wallet.signTransactions([gtxn1, gtxn2, gtxn3], [0, 2])

      // Should only sign indexes 0 and 2
      expect(result.length).toBe(2)
    })

    it('should return empty array when no transactions to sign', async () => {
      const otherAddress = 'EW64GC6F24M7NDSC5R3ES4YUVE3ZXXNMARJHDCCCLIHZU6TBEOC7XRSBG4'
      const txn = makePayTxn({ sender: otherAddress })

      const result = await wallet.signTransactions([txn])

      expect(result.length).toBe(0)
    })

    it('should handle encoded transactions', async () => {
      const txn = makePayTxn({ amount: 1000 })
      const encodedTxn = txn.toByte()

      const result = await wallet.signTransactions([encodedTxn])

      expect(result.length).toBe(1)
      expect(result[0]).toBeInstanceOf(Uint8Array)
    })

    it('should clear key material after signing (security test)', async () => {
      const txn = makePayTxn({ amount: 1000 })

      // This test verifies that the key is fetched fresh each time
      // and the provider.request is called for each sign operation
      await wallet.signTransactions([txn])

      // First call was from connect(), second from signTransactions()
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledTimes(2)
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledWith({ method: 'private_key' })
    })
  })

  describe('security properties', () => {
    it('should fetch key fresh for each signing operation', async () => {
      await wallet.connect()

      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: TEST_ADDRESS,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: TEST_ADDRESS, amount: 1000 }
      })

      await wallet.signTransactions([txn])
      await wallet.signTransactions([txn])

      // Connect calls it once, then each signTransactions call should fetch fresh
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledTimes(3)
    })
  })

  describe('usingSFA persistence', () => {
    it('should save usingSFA=true metadata after SFA connection', async () => {
      const customAuth = {
        idToken: 'mock-firebase-id-token',
        verifierId: 'user@example.com',
        verifier: 'my-firebase-verifier'
      }

      await wallet.connect(customAuth)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_WEB3AUTH_KEY,
        JSON.stringify({ usingSFA: true })
      )
    })

    it('should save usingSFA=false metadata after modal connection', async () => {
      await wallet.connect()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        LOCAL_STORAGE_WEB3AUTH_KEY,
        JSON.stringify({ usingSFA: false })
      )
    })

    it('should clear metadata after disconnect', async () => {
      await wallet.connect()
      await wallet.disconnect()

      expect(localStorage.removeItem).toHaveBeenCalledWith(LOCAL_STORAGE_WEB3AUTH_KEY)
    })

    it('should restore usingSFA from metadata during resumeSession', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'test@example.com', address: TEST_ADDRESS }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store

      // Mock metadata stored for SFA user
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === LOCAL_STORAGE_WEB3AUTH_KEY) {
          return JSON.stringify({ usingSFA: true })
        }
        return null
      })

      wallet = createWallet(harness.accessor)
      await wallet.resumeSession()

      expect(localStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_WEB3AUTH_KEY)
      expect(wallet.isConnected).toBe(true)
    })

    it('should use SFA reconnection after resuming SFA session', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'user@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'user@example.com', address: TEST_ADDRESS }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store

      // Create wallet with getAuthCredentials callback for SFA re-auth
      const walletWithCredentials = new Web3AuthAdapter({
        id: WALLET_ID,
        metadata: Web3AuthAdapter.defaultMetadata,
        store: harness.accessor,
        subscribe: vi.fn(),
        getAlgodClient: () => ({}) as any,
        options: {
          clientId: 'mock-client-id',
          verifier: 'my-verifier',
          getAuthCredentials: async () => ({
            idToken: 'fresh-token',
            verifierId: 'user@example.com'
          })
        }
      })

      // Mock metadata stored for SFA user
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === LOCAL_STORAGE_WEB3AUTH_KEY) {
          return JSON.stringify({ usingSFA: true })
        }
        return null
      })

      await walletWithCredentials.resumeSession()

      // Reset call counts to track only reconnection calls
      vi.mocked(mockWeb3AuthSFA.connect).mockClear()
      vi.mocked(mockWeb3Auth.connect).mockClear()

      // Make a transaction to trigger re-auth
      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: TEST_ADDRESS,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: TEST_ADDRESS, amount: 1000 }
      })

      await walletWithCredentials.signTransactions([txn])

      // Should have used SFA for re-authentication, not modal
      expect(mockWeb3AuthSFA.connect).toHaveBeenCalled()
      expect(mockWeb3Auth.connect).not.toHaveBeenCalled()

      await walletWithCredentials.disconnect()
    })

    it('should use modal reconnection after resuming modal session', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'test@example.com', address: TEST_ADDRESS }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store

      // Mock metadata stored for modal user
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === LOCAL_STORAGE_WEB3AUTH_KEY) {
          return JSON.stringify({ usingSFA: false })
        }
        return null
      })

      wallet = createWallet(harness.accessor)
      await wallet.resumeSession()

      // Reset call counts to track only reconnection calls
      vi.mocked(mockWeb3AuthSFA.connect).mockClear()
      vi.mocked(mockWeb3Auth.connect).mockClear()

      // Make a transaction to trigger re-auth
      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: TEST_ADDRESS,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: TEST_ADDRESS, amount: 1000 }
      })

      await wallet.signTransactions([txn])

      // Should have used modal for re-authentication, not SFA
      expect(mockWeb3Auth.connect).toHaveBeenCalled()
      expect(mockWeb3AuthSFA.connect).not.toHaveBeenCalled()
    })

    it('should default to modal reconnection when no metadata exists', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: TEST_ADDRESS }],
        activeAccount: { name: 'test@example.com', address: TEST_ADDRESS }
      }

      const harness = createTestHarness(WALLET_ID, {
        wallets: { [WALLET_ID]: walletState }
      })
      store = harness.store

      // No metadata stored (simulates upgrade from old version)
      vi.mocked(localStorage.getItem).mockImplementation(() => null)

      wallet = createWallet(harness.accessor)
      await wallet.resumeSession()

      // Reset call counts to track only reconnection calls
      vi.mocked(mockWeb3AuthSFA.connect).mockClear()
      vi.mocked(mockWeb3Auth.connect).mockClear()

      // Make a transaction to trigger re-auth
      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: TEST_ADDRESS,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: TEST_ADDRESS, amount: 1000 }
      })

      await wallet.signTransactions([txn])

      // Should default to modal (usingSFA defaults to false)
      expect(mockWeb3Auth.connect).toHaveBeenCalled()
      expect(mockWeb3AuthSFA.connect).not.toHaveBeenCalled()
    })

    it('should not save metadata when connection fails', async () => {
      mockWeb3Auth.connect.mockResolvedValueOnce(null)

      await expect(wallet.connect()).rejects.toThrow('Failed to connect to Web3Auth')

      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        LOCAL_STORAGE_WEB3AUTH_KEY,
        expect.any(String)
      )
    })

    it('should not save metadata when SFA connection fails', async () => {
      const customAuth = {
        idToken: 'mock-firebase-id-token',
        verifierId: 'user@example.com',
        verifier: 'my-firebase-verifier'
      }

      mockWeb3AuthSFA.connect.mockRejectedValueOnce(new Error('SFA connection failed'))

      await expect(wallet.connect(customAuth)).rejects.toThrow('SFA connection failed')

      expect(localStorage.setItem).not.toHaveBeenCalledWith(
        LOCAL_STORAGE_WEB3AUTH_KEY,
        expect.any(String)
      )
    })
  })

  describe('lazy authentication', () => {
    const connectedAddress = TEST_ADDRESS

    const makePayTxn = () => {
      return new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: connectedAddress,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: connectedAddress, amount: 1000 }
      })
    }

    it('should re-authenticate via modal when session expired during signing', async () => {
      // First, connect normally
      await wallet.connect()
      expect(wallet.isConnected).toBe(true)

      // Simulate session expiry
      mockWeb3Auth.connected = false
      mockWeb3Auth.provider = null

      // Reset mock to track new calls
      vi.mocked(mockWeb3Auth.connect).mockClear()

      // Re-enable for reconnection
      mockWeb3Auth.connect.mockImplementation(async () => {
        mockWeb3Auth.connected = true
        mockWeb3Auth.provider = mockWeb3AuthProvider
        return mockWeb3AuthProvider
      })

      const txn = makePayTxn()
      await wallet.signTransactions([txn])

      // Should have called connect() again to re-authenticate
      expect(mockWeb3Auth.connect).toHaveBeenCalled()
    })

    it('should throw error when modal re-authentication is cancelled', async () => {
      await wallet.connect()

      // Simulate session expiry
      mockWeb3Auth.connected = false
      mockWeb3Auth.provider = null

      // Modal returns null (user cancelled)
      mockWeb3Auth.connect.mockResolvedValueOnce(null)

      const txn = makePayTxn()
      await expect(wallet.signTransactions([txn])).rejects.toThrow(
        'Re-authentication cancelled or failed'
      )
    })

    it('should not re-authenticate when session is still valid', async () => {
      await wallet.connect()

      // Session is still valid
      expect(mockWeb3Auth.connected).toBe(true)

      vi.mocked(mockWeb3Auth.connect).mockClear()

      const txn = makePayTxn()
      await wallet.signTransactions([txn])

      // Should NOT have called connect() again
      expect(mockWeb3Auth.connect).not.toHaveBeenCalled()
    })
  })

  describe('withPrivateKey', () => {
    beforeEach(async () => {
      await wallet.connect()
    })

    it('should provide 64-byte Algorand secret key to callback', async () => {
      const result = await wallet.withPrivateKey(async (secretKey) => {
        expect(secretKey).toBeInstanceOf(Uint8Array)
        expect(secretKey.length).toBe(64)
        return 'test-result'
      })
      expect(result).toBe('test-result')
    })

    it('should zero the key after callback completes', async () => {
      let capturedKey: Uint8Array | null = null

      await wallet.withPrivateKey(async (secretKey) => {
        capturedKey = secretKey
        // Key should be non-zero during callback
        expect(secretKey.some((byte) => byte !== 0)).toBe(true)
      })

      // Key should be zeroed after callback
      expect(capturedKey!.every((byte) => byte === 0)).toBe(true)
    })

    it('should zero the key even if callback throws', async () => {
      let capturedKey: Uint8Array | null = null

      await expect(
        wallet.withPrivateKey(async (secretKey) => {
          capturedKey = secretKey
          throw new Error('Callback error')
        })
      ).rejects.toThrow('Callback error')

      expect(capturedKey!.every((byte) => byte === 0)).toBe(true)
    })

    it('should re-authenticate if session expired', async () => {
      // Simulate session expiry
      mockWeb3Auth.connected = false
      mockWeb3Auth.provider = null

      vi.mocked(mockWeb3Auth.connect).mockClear()
      mockWeb3Auth.connect.mockImplementation(async () => {
        mockWeb3Auth.connected = true
        mockWeb3Auth.provider = mockWeb3AuthProvider
        return mockWeb3AuthProvider
      })

      await wallet.withPrivateKey(async (secretKey) => {
        expect(secretKey.length).toBe(64)
      })

      expect(mockWeb3Auth.connect).toHaveBeenCalled()
    })

    it('should fetch key fresh for each call', async () => {
      const initialCalls = mockWeb3AuthProvider.request.mock.calls.length

      await wallet.withPrivateKey(async () => {})
      await wallet.withPrivateKey(async () => {})

      // Each withPrivateKey call should trigger a fresh provider.request
      expect(mockWeb3AuthProvider.request.mock.calls.length).toBe(initialCalls + 2)
    })

    it('should report canUsePrivateKey as true', () => {
      expect(wallet.canUsePrivateKey).toBe(true)
    })
  })
})
