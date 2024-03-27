import { NetworkId } from 'src/network'
import { LOCAL_STORAGE_KEY, State, defaultState } from 'src/store'
import { WalletManager } from 'src/manager'
import { StorageAdapter } from 'src/storage'
// import { DeflyWallet } from 'src/wallets/defly'
// import { PeraWallet } from 'src/wallets/pera'
import { WalletId } from 'src/wallets/types'

// Mock storage adapter
vi.mock('src/storage', () => ({
  StorageAdapter: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

// Suppress console output
vi.spyOn(console, 'info').mockImplementation(() => {})

// Mock console.warn
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

// Mock console.error
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// const deflyResumeSession = vi
//   .spyOn(DeflyWallet.prototype, 'resumeSession')
//   .mockImplementation(() => Promise.resolve())
// const peraResumeSession = vi
//   .spyOn(PeraWallet.prototype, 'resumeSession')
//   .mockImplementation(() => Promise.resolve())

describe('WalletManager', () => {
  let mockInitialState: State | null = null

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(StorageAdapter.getItem).mockImplementation((key: string) => {
      if (key === LOCAL_STORAGE_KEY && mockInitialState !== null) {
        return JSON.stringify(mockInitialState)
      }
      return null
    })

    // Reset to null before each test
    mockInitialState = null
  })

  describe('constructor', () => {
    it('initializes with default network and wallets', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.wallets.length).toBe(2)
      expect(manager.activeNetwork).toBe(NetworkId.TESTNET)
      expect(manager.algodClient).toBeDefined()
    })

    it('initializes with custom network and wallets', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA],
        network: NetworkId.MAINNET
      })
      expect(manager.wallets.length).toBe(2)
      expect(manager.activeNetwork).toBe(NetworkId.MAINNET)
      expect(manager.algodClient).toBeDefined()
    })

    it('initializes with custom algod config', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA],
        network: NetworkId.LOCALNET,
        algod: {
          baseServer: 'http://localhost',
          port: '1234',
          token: '1234',
          headers: {
            'X-API-Key': '1234'
          }
        }
      })

      expect(manager.wallets.length).toBe(2)
      expect(manager.activeNetwork).toBe(NetworkId.LOCALNET)
      expect(manager.algodClient).toBeDefined()
    })
  })

  describe('initializeWallets', () => {
    it('initializes wallets from string array', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets from WalletIdConfig array', () => {
      const manager = new WalletManager({
        wallets: [
          {
            id: WalletId.DEFLY,
            options: {
              shouldShowSignTxnToast: false
            }
          },
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: '1234'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets from mixed array', () => {
      const manager = new WalletManager({
        wallets: [
          WalletId.DEFLY,
          {
            id: WalletId.WALLETCONNECT,
            options: {
              projectId: '1234'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(2)
    })

    it('initializes wallets with custom metadata', () => {
      const manager = new WalletManager({
        wallets: [
          {
            id: WalletId.DEFLY,
            metadata: {
              name: 'Custom Wallet',
              icon: 'icon'
            }
          }
        ]
      })
      expect(manager.wallets.length).toBe(1)
      expect(manager.wallets[0]?.metadata.name).toBe('Custom Wallet')
      expect(manager.wallets[0]?.metadata.icon).toBe('icon')
    })

    // @todo: Test for handling of invalid wallet configurations
  })

  describe('setActiveNetwork', () => {
    it('sets active network correctly', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      manager.setActiveNetwork(NetworkId.MAINNET)
      expect(manager.activeNetwork).toBe(NetworkId.MAINNET)
    })

    // @todo: Test for handling of invalid network
  })

  describe('subscribe', () => {
    it('adds and removes a subscriber', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      const callback = vi.fn()
      const unsubscribe = manager.subscribe(callback)

      // Trigger a state change
      manager.setActiveNetwork(NetworkId.MAINNET)

      expect(callback).toHaveBeenCalled()

      unsubscribe()
      // Trigger another state change
      manager.setActiveNetwork(NetworkId.BETANET)

      expect(callback).toHaveBeenCalledTimes(1) // Should not be called again
    })
  })

  describe('loadPersistedState', () => {
    beforeEach(() => {
      mockInitialState = {
        wallets: {
          [WalletId.PERA]: {
            accounts: [
              {
                name: 'Pera Wallet 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              },
              {
                name: 'Pera Wallet 2',
                address: 'N2C374IRX7HEX2YEQWJBTRSVRHRUV4ZSF76S54WV4COTHRUNYRCI47R3WU'
              }
            ],
            activeAccount: {
              name: 'Pera Wallet 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: WalletId.PERA,
        activeNetwork: NetworkId.BETANET
      }
    })

    it('loads persisted state correctly', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.store.state).toEqual(mockInitialState)
      expect(manager.activeWallet?.id).toBe(WalletId.PERA)
      expect(manager.activeNetwork).toBe(NetworkId.BETANET)
    })

    it('returns null if no persisted state', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })

      // Store initializes with default state if null is returned
      expect(manager.store.state).toEqual(defaultState)
      expect(manager.activeWallet).toBeNull()
      expect(manager.activeNetwork).toBe(NetworkId.TESTNET)
    })

    it('returns null and logs warning and error if persisted state is invalid', () => {
      const invalidState = { foo: 'bar' }
      // @ts-expect-error - Set invalid state
      mockInitialState = invalidState

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(mockConsoleWarn).toHaveBeenCalledWith('[Store] Parsed state:', invalidState)
      expect(mockConsoleError).toHaveBeenCalledWith(
        '[Store] Could not load state from local storage: Persisted state is invalid'
      )
      // Store initializes with default state if null is returned
      expect(manager.store.state).toEqual(defaultState)
    })
  })

  describe('savePersistedState', () => {
    it('saves state to local storage', () => {
      const stateToSave: State = {
        wallets: {},
        activeWallet: null,
        activeNetwork: NetworkId.MAINNET
      }

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      manager.setActiveNetwork(NetworkId.MAINNET)

      expect(vi.mocked(StorageAdapter.setItem)).toHaveBeenCalledWith(
        LOCAL_STORAGE_KEY,
        JSON.stringify(stateToSave)
      )
    })
  })

  describe('activeWallet', () => {
    beforeEach(() => {
      mockInitialState = {
        wallets: {
          [WalletId.PERA]: {
            accounts: [
              {
                name: 'Pera Wallet 1',
                address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
              },
              {
                name: 'Pera Wallet 2',
                address: 'N2C374IRX7HEX2YEQWJBTRSVRHRUV4ZSF76S54WV4COTHRUNYRCI47R3WU'
              }
            ],
            activeAccount: {
              name: 'Pera Wallet 1',
              address: '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q'
            }
          }
        },
        activeWallet: WalletId.PERA,
        activeNetwork: NetworkId.BETANET
      }
    })

    it('returns the active wallet', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.activeWallet?.id).toBe(WalletId.PERA)
    })

    it('returns null if no active wallet', () => {
      mockInitialState = null

      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.activeWallet).toBeNull()
    })

    it('returns active wallet accounts', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(manager.activeWalletAccounts?.length).toBe(2)
      expect(manager.activeWalletAddresses).toEqual([
        '7ZUECA7HFLZTXENRV24SHLU4AVPUTMTTDUFUBNBD64C73F3UHRTHAIOF6Q',
        'N2C374IRX7HEX2YEQWJBTRSVRHRUV4ZSF76S54WV4COTHRUNYRCI47R3WU'
      ])
    })

    it('removes wallets in state that are not in config', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY]
      })
      expect(manager.wallets.length).toBe(1)
      expect(manager.wallets[0]?.id).toBe(WalletId.DEFLY)
      expect(manager.activeWallet).toBeNull()
    })
  })

  describe('Transaction Signing', () => {
    it('throws error if no active wallet', () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      expect(() => manager.signTransactions).toThrow()
    })

    // @todo: Tests for successful signing
  })

  // @todo: Find out why this fails in Vitest
  describe.skip('resumeSessions', () => {
    it('resumes sessions for all wallets', async () => {
      const manager = new WalletManager({
        wallets: [WalletId.DEFLY, WalletId.PERA]
      })
      await manager.resumeSessions()

      // expect(deflyResumeSession).toHaveBeenCalled()
      // expect(peraResumeSession).toHaveBeenCalled()
    })
  })
})
