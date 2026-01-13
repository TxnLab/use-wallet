import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, DEFAULT_STATE } from 'src/store'
import { Web3AuthWallet } from 'src/wallets/web3auth'
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

// Generate a test key pair for mocking
// This is a deterministic test key - DO NOT use in production
const TEST_PRIVATE_KEY_HEX =
  'a'.repeat(64) // 32 bytes as hex (64 chars)

// Mock Web3Auth provider (shared between modal and SFA)
const mockWeb3AuthProvider = {
  request: vi.fn()
}

// Mock Web3Auth Modal client
const mockWeb3Auth = {
  initModal: vi.fn(),
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
  Web3Auth: vi.fn(() => mockWeb3Auth)
}))

vi.mock('@web3auth/single-factor-auth', () => ({
  Web3Auth: vi.fn(() => mockWeb3AuthSFA)
}))

vi.mock('@web3auth/base', () => ({
  CHAIN_NAMESPACES: {
    OTHER: 'other'
  },
  WEB3AUTH_NETWORK: {
    MAINNET: 'mainnet',
    TESTNET: 'testnet',
    SAPPHIRE_MAINNET: 'sapphire_mainnet',
    SAPPHIRE_DEVNET: 'sapphire_devnet',
    CYAN: 'cyan',
    AQUA: 'aqua'
  }
}))

vi.mock('@web3auth/base-provider', () => ({
  CommonPrivateKeyProvider: vi.fn(() => ({}))
}))

function createWalletWithStore(store: Store<State>): Web3AuthWallet {
  return new Web3AuthWallet({
    id: WalletId.WEB3AUTH,
    options: {
      clientId: 'mock-client-id'
    },
    metadata: {},
    getAlgodClient: {} as any,
    store,
    subscribe: vi.fn()
  })
}

// Pre-computed address derived from TEST_PRIVATE_KEY_HEX using tweetnacl
// This avoids needing async in the test setup
const TEST_ADDRESS = '442OU3BLMJL544RVLZDSVIC2JREH422GHQBJ5UYG34XQDNLDNNMHEHK46Y'

function getExpectedAddress(): string {
  return TEST_ADDRESS
}

describe('Web3AuthWallet', () => {
  let wallet: Web3AuthWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const testAddress = getExpectedAddress()

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

    // Reset mock Web3Auth Modal state
    mockWeb3Auth.connected = false
    mockWeb3Auth.provider = null
    mockWeb3Auth.initModal.mockResolvedValue(undefined)
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

    store = new Store<State>(DEFAULT_STATE)
    wallet = createWalletWithStore(store)
  })

  afterEach(async () => {
    try {
      await wallet.disconnect()
    } catch {
      // Ignore disconnect errors in cleanup
    }
    mockInitialState = null
  })

  describe('constructor', () => {
    it('should throw error if clientId is missing', () => {
      expect(
        () =>
          new Web3AuthWallet({
            id: WalletId.WEB3AUTH,
            options: {} as any,
            metadata: {},
            getAlgodClient: {} as any,
            store,
            subscribe: vi.fn()
          })
      ).toThrow('Missing required option: clientId')
    })
  })

  describe('connect', () => {
    it('should initialize client, authenticate, and return account', async () => {
      const result = await wallet.connect()

      expect(mockWeb3Auth.initModal).toHaveBeenCalled()
      expect(mockWeb3Auth.connect).toHaveBeenCalled()
      expect(mockWeb3Auth.getUserInfo).toHaveBeenCalled()
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledWith({ method: 'private_key' })

      expect(wallet.isConnected).toBe(true)
      expect(result.length).toBe(1)
      expect(result[0].address).toBe(testAddress)

      expect(store.state.wallets[WalletId.WEB3AUTH]).toEqual({
        accounts: [{ name: 'test@example.com', address: testAddress }],
        activeAccount: { name: 'test@example.com', address: testAddress }
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
      expect(result[0].address).toBe(testAddress)
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
      const walletWithVerifier = new Web3AuthWallet({
        id: WalletId.WEB3AUTH,
        options: {
          clientId: 'mock-client-id',
          verifier: 'default-verifier'
        },
        metadata: {},
        getAlgodClient: {} as any,
        store,
        subscribe: vi.fn()
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
      expect(store.state.wallets[WalletId.WEB3AUTH]).toBeUndefined()
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

      expect(mockWeb3Auth.getUserInfo).not.toHaveBeenCalled()
      expect(wallet.isConnected).toBe(false)
    })

    it('should disconnect if Web3Auth session expired', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: testAddress }],
        activeAccount: { name: 'test@example.com', address: testAddress }
      }

      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.WEB3AUTH]: walletState
        }
      })
      wallet = createWalletWithStore(store)

      // Web3Auth not connected
      mockWeb3Auth.connected = false
      mockWeb3Auth.provider = null

      await wallet.resumeSession()

      expect(store.state.wallets[WalletId.WEB3AUTH]).toBeUndefined()
    })

    it('should resume session if Web3Auth is connected', async () => {
      const walletState: WalletState = {
        accounts: [{ name: 'test@example.com', address: testAddress }],
        activeAccount: { name: 'test@example.com', address: testAddress }
      }

      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          [WalletId.WEB3AUTH]: walletState
        }
      })
      wallet = createWalletWithStore(store)

      // Initialize Web3Auth mock as connected
      mockWeb3Auth.connected = true
      mockWeb3Auth.provider = mockWeb3AuthProvider

      await wallet.resumeSession()

      expect(mockWeb3Auth.getUserInfo).toHaveBeenCalled()
      expect(wallet.isConnected).toBe(true)
    })
  })

  describe('signTransactions', () => {
    const connectedAddress = getExpectedAddress()

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
    it('should not persist private keys', async () => {
      await wallet.connect()

      // Check that storage was not called with any private key data
      const setItemCalls = vi.mocked(StorageAdapter.setItem).mock.calls
      for (const call of setItemCalls) {
        const value = call[1]
        expect(value).not.toContain(TEST_PRIVATE_KEY_HEX)
        expect(value).not.toContain('privateKey')
        expect(value).not.toContain('secretKey')
      }
    })

    it('should fetch key fresh for each signing operation', async () => {
      await wallet.connect()

      const txn = new algosdk.Transaction({
        type: algosdk.TransactionType.pay,
        sender: testAddress,
        suggestedParams: {
          fee: 0,
          firstValid: 51,
          lastValid: 61,
          minFee: 1000,
          genesisID: 'testnet-v1.0'
        },
        paymentParams: { receiver: testAddress, amount: 1000 }
      })

      await wallet.signTransactions([txn])
      await wallet.signTransactions([txn])

      // Connect calls it once, then each signTransactions call should fetch fresh
      expect(mockWeb3AuthProvider.request).toHaveBeenCalledTimes(3)
    })
  })
})
