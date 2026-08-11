import { Store } from '@tanstack/store'
import { Algodv2 } from 'algosdk'
import {
  State,
  PersistedState,
  addWallet,
  DEFAULT_STATE,
  removeWallet,
  setAccounts,
  setActiveAccount,
  setActiveNetwork,
  setActiveWallet,
  isValidPersistedState,
  isValidWalletAccount,
  isValidWalletState
} from 'src/store'

// Mock the logger
vi.mock('src/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('Mutations', () => {
  let store: Store<State>

  beforeEach(() => {
    store = new Store<State>(DEFAULT_STATE)
  })

  describe('addWallet', () => {
    it('should add a new wallet and set it as active', () => {
      const walletId = 'defly'
      const account = {
        name: 'Defly Wallet 1',
        address: 'address'
      }
      const walletState = {
        accounts: [account],
        activeAccount: account
      }

      addWallet(store, { walletId, wallet: walletState })

      const state = store.state
      expect(state.wallets[walletId]).toEqual(walletState)
      expect(state.activeWallet).toBe(walletId)
    })

    it('should create new object references when adding a wallet', () => {
      const walletId = 'defly'
      const account1 = {
        name: 'Defly Wallet 1',
        address: 'address1'
      }
      const account2 = {
        name: 'Defly Wallet 2',
        address: 'address2'
      }
      const walletState = {
        accounts: [account1, account2],
        activeAccount: account1
      }

      const originalWalletState = { ...walletState }

      addWallet(store, { walletId, wallet: walletState })

      const storedWallet = store.state.wallets[walletId]

      // Check that new object references were created
      expect(storedWallet).not.toBe(walletState)
      expect(storedWallet?.accounts).not.toBe(walletState.accounts)
      expect(storedWallet?.activeAccount).not.toBe(walletState.activeAccount)

      // Check that the content is still correct
      expect(storedWallet?.accounts).toEqual([account1, account2])
      expect(storedWallet?.activeAccount).toEqual(account1)

      // Modify the stored wallet state
      storedWallet!.accounts[0].name = 'Modified Name'

      // Check that the original wallet state is unchanged
      expect(walletState).toEqual(originalWalletState)
    })
  })

  describe('removeWallet', () => {
    beforeEach(() => {
      store = new Store<State>({
        ...DEFAULT_STATE,
        wallets: {
          defly: {
            accounts: [{ name: 'Defly Wallet 1', address: 'address' }],
            activeAccount: { name: 'Defly Wallet 1', address: 'address' }
          },
          pera: {
            accounts: [{ name: 'Pera Wallet 1', address: 'address' }],
            activeAccount: { name: 'Pera Wallet 1', address: 'address' }
          }
        },
        activeWallet: 'defly'
      })
    })

    it('should remove an active wallet', () => {
      expect(store.state.wallets['defly']).toBeDefined()
      expect(store.state.activeWallet).toBe('defly')

      removeWallet(store, { walletId: 'defly' })
      expect(store.state.wallets['defly']).toBeUndefined()
      expect(store.state.activeWallet).toBeNull()
    })

    it('should remove a non-active wallet', () => {
      expect(store.state.wallets['pera']).toBeDefined()

      removeWallet(store, { walletId: 'pera' })
      expect(store.state.wallets['pera']).toBeUndefined()
      expect(store.state.activeWallet).toBe('defly')
    })

    it('should do nothing if walletId is not in wallets map', () => {
      expect(Object.keys(store.state.wallets).length).toBe(2)

      removeWallet(store, { walletId: 'exodus' })

      expect(Object.keys(store.state.wallets).length).toBe(2)
      expect(store.state.activeWallet).toBe('defly')
    })
  })

  describe('setActiveWallet', () => {
    it('should set the active wallet', () => {
      setActiveWallet(store, { walletId: 'defly' })
      expect(store.state.activeWallet).toBe('defly')
    })

    it('should set the active wallet to null', () => {
      addWallet(store, {
        walletId: 'defly',
        wallet: {
          accounts: [{ name: 'Defly Wallet 1', address: 'address' }],
          activeAccount: { name: 'Defly Wallet 1', address: 'address' }
        }
      })
      expect(store.state.activeWallet).toBe('defly')

      setActiveWallet(store, { walletId: null })
      expect(store.state.activeWallet).toBeNull()
    })
  })

  describe('setActiveAccount', () => {
    it('should set the active account', () => {
      const account1 = { name: 'Defly Wallet 1', address: 'address1' }
      const account2 = { name: 'Defly Wallet 2', address: 'address2' }

      addWallet(store, {
        walletId: 'defly',
        wallet: { accounts: [account1, account2], activeAccount: account1 }
      })
      expect(store.state.wallets['defly']?.activeAccount).toEqual(account1)

      setActiveAccount(store, { walletId: 'defly', address: account2.address })
      expect(store.state.wallets['defly']?.activeAccount).toEqual(account2)
    })

    it('should do nothing if walletId is not in wallets map', () => {
      const account1 = { name: 'Defly Wallet 1', address: 'address1' }

      addWallet(store, {
        walletId: 'defly',
        wallet: { accounts: [account1], activeAccount: account1 }
      })

      setActiveAccount(store, { walletId: 'exodus', address: 'exodusAddress' })
      expect(store.state.wallets['defly']?.activeAccount).toEqual(account1)
    })

    it('should do nothing if provided account is not found in wallet state', () => {
      const account1 = { name: 'Defly Wallet 1', address: 'address1' }

      addWallet(store, {
        walletId: 'defly',
        wallet: { accounts: [account1], activeAccount: account1 }
      })

      setActiveAccount(store, { walletId: 'defly', address: 'foo' })
      expect(store.state.wallets['defly']?.activeAccount).toEqual(account1)
    })
  })

  describe('setAccounts', () => {
    it('should set new accounts', () => {
      const account1 = { name: 'Defly Wallet 1', address: 'address1' }
      const account2 = { name: 'Defly Wallet 2', address: 'address2' }

      addWallet(store, {
        walletId: 'defly',
        wallet: { accounts: [account1], activeAccount: account1 }
      })
      expect(store.state.wallets['defly']?.accounts).toEqual([account1])

      setAccounts(store, { walletId: 'defly', accounts: [account1, account2] })
      expect(store.state.wallets['defly']?.accounts).toEqual([account1, account2])
    })

    it('should set the active account if previous active account is not in new accounts list', () => {
      const account1 = { name: 'Defly Wallet 1', address: 'address1' }
      const account2 = { name: 'Defly Wallet 2', address: 'address2' }
      const account3 = { name: 'Defly Wallet 3', address: 'address3' }

      addWallet(store, {
        walletId: 'defly',
        wallet: { accounts: [account1], activeAccount: account1 }
      })

      setAccounts(store, { walletId: 'defly', accounts: [account2, account3] })
      expect(store.state.wallets['defly']?.activeAccount).toEqual(account2)
    })
  })

  describe('setActiveNetwork', () => {
    it('should set the active network', () => {
      expect(store.state.activeNetwork).toBe('testnet')

      const algodClient = new Algodv2('', 'https://mainnet-api.4160.nodely.dev/')
      setActiveNetwork(store, { networkId: 'mainnet', algodClient })
      expect(store.state.activeNetwork).toBe('mainnet')
    })
  })
})

describe('Type Guards', () => {
  describe('isValidWalletAccount', () => {
    it('returns true for a valid WalletAccount', () => {
      expect(isValidWalletAccount({ name: 'Defly Wallet 1', address: 'address' })).toBe(true)
    })

    it('returns false for an invalid WalletAccount', () => {
      expect(isValidWalletAccount('foo')).toBe(false)
      expect(isValidWalletAccount(null)).toBe(false)
      expect(isValidWalletAccount({ name: 'Defly Wallet 1', address: 123 })).toBe(false)
      expect(isValidWalletAccount({ address: 'address' })).toBe(false)
    })
  })

  describe('isValidWalletState', () => {
    it('returns true for a valid WalletState', () => {
      expect(
        isValidWalletState({
          accounts: [{ name: 'Defly Wallet 1', address: 'address' }],
          activeAccount: { name: 'Defly Wallet 1', address: 'address' }
        })
      ).toBe(true)

      expect(isValidWalletState({ accounts: [], activeAccount: null })).toBe(true)
    })

    it('returns false for an invalid WalletState', () => {
      expect(isValidWalletState('foo')).toBe(false)
      expect(isValidWalletState(null)).toBe(false)
    })
  })

  describe('isValidPersistedState', () => {
    it('returns true for a valid state', () => {
      const defaultState: PersistedState = {
        wallets: {},
        activeWallet: null,
        activeNetwork: 'testnet',
        customNetworkConfigs: {}
      }
      expect(isValidPersistedState(defaultState)).toBe(true)
    })

    it('returns false for an invalid state', () => {
      expect(isValidPersistedState('foo')).toBe(false)
      expect(isValidPersistedState(null)).toBe(false)
      expect(isValidPersistedState({ activeWallet: 'defly', activeNetwork: 'testnet' })).toBe(false)
      expect(isValidPersistedState({ wallets: {}, activeNetwork: 'testnet' })).toBe(false)
      expect(isValidPersistedState({ wallets: {}, activeWallet: 'defly' })).toBe(false)
    })
  })
})
