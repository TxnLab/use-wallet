import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { Store } from '@tanstack/store'
import { Transaction, TransactionType } from 'algosdk'
import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, State, WalletState, defaultState } from 'src/store'
import { LiquidWallet } from 'src/wallets/liquid'
import { WalletId } from 'src/wallets/types'
import { DEFAULT_NETWORKS } from 'src/network'

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
    setItem: vi.fn()
  }
}))

// Spy/suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {}) // @todo: remove when debug logger is implemented
vi.spyOn(console, 'warn').mockImplementation(() => {})

// Mock LiquidAuthClient
const mockLiquidAuthClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  checkSession: vi.fn().mockResolvedValue({ user: { wallet: 'mockWalletAddress' } }), // Ensure checkSession returns the correct data
  signTransactions: vi.fn().mockResolvedValue([new Uint8Array()]),
  hideModal: vi.fn()
}

// Mock the module
vi.mock('@algorandfoundation/liquid-auth-use-wallet-client', () => ({
  LiquidAuthClient: vi.fn().mockImplementation(() => mockLiquidAuthClient),
  ICON: 'mockIcon'
}))

function createWalletWithStore(store: Store<State>): LiquidWallet {
  return new LiquidWallet({
    id: WalletId.LIQUID,
    options: {
      RTC_config_username: 'username',
      RTC_config_credential: 'credential'
    },
    metadata: {},
    getAlgodClient: () => ({}) as any,
    store,
    subscribe: vi.fn(),
    networks: DEFAULT_NETWORKS
  })
}

describe('LiquidWallet', () => {
  let wallet: LiquidWallet
  let store: Store<State>
  let mockInitialState: State | null = null
  let mockLogger: {
    debug: Mock
    info: Mock
    warn: Mock
    error: Mock
  }

  const account1 = {
    name: 'Liquid Account 1',
    address: 'mockWalletAddress'
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
    if (wallet.authClient) {
      await wallet.disconnect()
    }
  })

  describe('connect', () => {
    it('connect: should return accounts and update store', async () => {
      // Mock the connect method to resolve with the account address
      mockLiquidAuthClient.connect.mockResolvedValueOnce([account1.address])

      // Mock the checkSession method to resolve with a proper user wallet object
      mockLiquidAuthClient.checkSession.mockResolvedValueOnce({
        user: { wallet: account1.address }
      })

      // Call the connect method on the wallet
      const accounts = await wallet.connect()

      // Verify that the connect method was called
      expect(mockLiquidAuthClient.connect).toHaveBeenCalled()

      // Verify that the accounts returned are as expected
      expect(accounts).toEqual([{ name: 'Liquid Account 1', address: 'mockWalletAddress' }])

      // Verify that the wallet is connected
      expect(wallet.isConnected).toBe(true)

      // Verify that the hideModal method was called
      expect(mockLiquidAuthClient.hideModal).toHaveBeenCalled()
    })

    it('connect: should throw an error if no accounts are found', async () => {
      mockLiquidAuthClient.checkSession.mockResolvedValueOnce({ user: { wallet: null } })

      await expect(wallet.connect()).rejects.toThrowError('No accounts found!')
      expect(wallet.isConnected).toBe(false)
    })

    it('connect: should re-throw an error thrown by authClient.connect', async () => {
      mockLiquidAuthClient.connect.mockRejectedValueOnce(new Error('mock error'))

      await expect(wallet.connect()).rejects.toThrowError('mock error')
      expect(wallet.isConnected).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('disconnect: should call authClient.disconnect and update store', async () => {
      await wallet.connect()
      await wallet.disconnect()

      expect(mockLiquidAuthClient.disconnect).toHaveBeenCalled()
      expect(store.state.wallets[WalletId.LIQUID]).toBeUndefined()
      expect(wallet.isConnected).toBe(false)
    })

    it('disconnect: should throw an error if no auth client is found', async () => {
      wallet.authClient = null

      await expect(wallet.disconnect()).rejects.toThrowError('No auth client to disconnect')
    })
  })

  describe('resumeSession', () => {
    it('resumeSession: should call disconnect if wallet state exists', async () => {
      const walletState: WalletState = {
        accounts: [account1],
        activeAccount: account1
      }

      store = new Store<State>({
        ...defaultState,
        wallets: {
          [WalletId.LIQUID]: walletState
        }
      })

      wallet = createWalletWithStore(store)

      const disconnectSpy = vi.spyOn(wallet, 'disconnect')
      await wallet.resumeSession()

      expect(disconnectSpy).toHaveBeenCalled()
    })

    it('resumeSession: should not call disconnect if no wallet state exists', async () => {
      const disconnectSpy = vi.spyOn(wallet, 'disconnect')
      await wallet.resumeSession()

      expect(disconnectSpy).not.toHaveBeenCalled()
    })
  })

  describe('signTransactions', () => {
    const suggestedParams = {
      flatFee: false,
      fee: 0,
      firstValid: 43564565,
      lastValid: 43565565,
      genesisID: 'testnet-v1.0',
      minFee: 1000
    }

    const algoAddress = '6R7VBOFIZCNA5PTJDOFEWBDYZXDATQILK3AYZRBG77Y56XPMTSPVZICOEI'

    const txnGroup = [
      new Transaction({
        type: TransactionType.pay,
        sender: algoAddress,
        suggestedParams,
        paymentParams: { receiver: algoAddress, amount: 0 }
      })
    ]

    const indexesToSign = [0]

    it('signTransaction: should call authClient.signTransactions', async () => {
      // Ensure the wallet is connected and has an active account
      await wallet.connect()

      await wallet.signTransactions(txnGroup, indexesToSign)

      expect(mockLiquidAuthClient.signTransactions).toHaveBeenCalled()
      expect(mockLiquidAuthClient.signTransactions).toHaveBeenCalledWith(
        txnGroup,
        wallet.activeAddress,
        indexesToSign
      )
    })

    it('signTransaction: should throw an error if no active account', async () => {
      vi.spyOn(wallet, 'activeAddress', 'get').mockReturnValue(null)

      await expect(wallet.signTransactions(txnGroup, indexesToSign)).rejects.toThrowError(
        'No active account'
      )
    })
  })
})
