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
  isValidWalletId,
  isValidWalletState
} from 'src/store'
import { WalletId } from 'src/wallets/types'

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
      const walletId = WalletId.DEFLY
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
      const walletId = WalletId.DEFLY
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
          [WalletId.DEFLY]: {
            accounts: [
              {
                name: 'Defly Wallet 1',
                address: 'address'
              }
            ],
            activeAccount: {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          },
          [WalletId.PERA]: {
            accounts: [
              {
                name: 'Pera Wallet 1',
                address: 'address'
              }
            ],
            activeAccount: {
              name: 'Pera Wallet 1',
              address: 'address'
            }
          }
        },
        activeWallet: WalletId.DEFLY
      })
    })

    it('should remove an active wallet', () => {
      const walletId = WalletId.DEFLY

      expect(store.state.wallets[walletId]).toBeDefined()
      expect(store.state.activeWallet).toBe(walletId)

      removeWallet(store, { walletId })
      expect(store.state.wallets[walletId]).toBeUndefined()

      // Active wallet should be null
      expect(store.state.activeWallet).toBeNull()
    })

    it('should remove a non-active wallet', () => {
      const walletId = WalletId.PERA
      const activeWallet = store.state.activeWallet

      expect(store.state.wallets[walletId]).toBeDefined()

      removeWallet(store, { walletId })
      expect(store.state.wallets[walletId]).toBeUndefined()

      // Active wallet should not change
      expect(store.state.activeWallet).toBe(activeWallet)
    })

    it('should do nothing if walletId is not in wallets map', () => {
      const walletId = WalletId.EXODUS
      const activeWallet = store.state.activeWallet

      expect(Object.keys(store.state.wallets).length).toBe(2)
      expect(store.state.wallets[walletId]).toBeUndefined()

      removeWallet(store, { walletId })
      expect(store.state.wallets[walletId]).toBeUndefined()

      // Wallets map should not change
      expect(Object.keys(store.state.wallets).length).toBe(2)

      // Active wallet should not change
      expect(store.state.activeWallet).toBe(activeWallet)
    })
  })

  describe('setActiveWallet', () => {
    // @todo: Should fail if walletId is not in wallets map
    it('should set the active wallet', () => {
      setActiveWallet(store, { walletId: WalletId.DEFLY })
      expect(store.state.activeWallet).toBe(WalletId.DEFLY)
    })

    it('should set the active wallet to null', () => {
      addWallet(store, {
        walletId: WalletId.DEFLY,
        wallet: {
          accounts: [
            {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          ],
          activeAccount: {
            name: 'Defly Wallet 1',
            address: 'address'
          }
        }
      })
      expect(store.state.activeWallet).toBe(WalletId.DEFLY)

      setActiveWallet(store, { walletId: null })
      expect(store.state.activeWallet).toBeNull()
    })
  })

  describe('setActiveAccount', () => {
    it('should set the active account', () => {
      const walletId = WalletId.DEFLY
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

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)

      setActiveAccount(store, { walletId, address: account2.address })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account2)
    })

    it('should do nothing if walletId is not in wallets map', () => {
      const walletId = WalletId.DEFLY
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

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)

      setActiveAccount(store, { walletId: WalletId.EXODUS, address: 'exodusAddress' })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)
    })

    it('should do nothing if provided account is not found in wallet state', () => {
      const walletId = WalletId.DEFLY
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

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)

      setActiveAccount(store, { walletId: WalletId.DEFLY, address: 'foo' })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)
    })

    it('should not modify other accounts when setting active account', () => {
      const walletId = WalletId.DEFLY
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

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.accounts).toEqual([account1, account2])
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)

      setActiveAccount(store, { walletId, address: account2.address })

      // Check that active account has changed
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account2)

      // Check that accounts array is unchanged
      expect(store.state.wallets[walletId]?.accounts).toEqual([account1, account2])

      // Verify that the first account in the array is still account1
      expect(store.state.wallets[walletId]?.accounts[0]).toEqual(account1)
    })

    it('should create new object references for active account and accounts array', () => {
      const walletId = WalletId.DEFLY
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

      addWallet(store, { walletId, wallet: walletState })
      const originalWallet = store.state.wallets[walletId]
      const originalAccounts = originalWallet?.accounts
      const originalActiveAccount = originalWallet?.activeAccount

      setActiveAccount(store, { walletId, address: account2.address })

      const updatedWallet = store.state.wallets[walletId]
      const updatedAccounts = updatedWallet?.accounts
      const updatedActiveAccount = updatedWallet?.activeAccount

      // Check that new object references were created
      expect(updatedWallet).not.toBe(originalWallet)
      expect(updatedAccounts).not.toBe(originalAccounts)
      expect(updatedActiveAccount).not.toBe(originalActiveAccount)

      // Check that the content is still correct
      expect(updatedAccounts).toEqual([account1, account2])
      expect(updatedActiveAccount).toEqual(account2)
    })
  })

  describe('setAccounts', () => {
    it('should set new accounts', () => {
      const walletId = WalletId.DEFLY
      const account1 = {
        name: 'Defly Wallet 1',
        address: 'address1'
      }
      const account2 = {
        name: 'Defly Wallet 2',
        address: 'address2'
      }
      const walletState = {
        accounts: [account1],
        activeAccount: account1
      }

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.accounts).toEqual([account1])

      const newAccounts = [account1, account2]
      setAccounts(store, { walletId, accounts: newAccounts })
      expect(store.state.wallets[walletId]?.accounts).toEqual(newAccounts)
    })

    it('should set the active account if previous active account is not in new accounts list', () => {
      const walletId = WalletId.DEFLY
      const account1 = {
        name: 'Defly Wallet 1',
        address: 'address1'
      }
      const account2 = {
        name: 'Defly Wallet 2',
        address: 'address2'
      }
      const account3 = {
        name: 'Defly Wallet 3',
        address: 'address3'
      }
      const walletState = {
        accounts: [account1],
        activeAccount: account1
      }

      addWallet(store, { walletId, wallet: walletState })
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account1)

      // New accounts list does not include active account (account1)
      const newAccounts = [account2, account3]
      setAccounts(store, { walletId, accounts: newAccounts })

      // Active account should be set to first account in new accounts list (account2)
      expect(store.state.wallets[walletId]?.activeAccount).toEqual(account2)
    })

    it('should create new object references when setting accounts', () => {
      const walletId = WalletId.DEFLY
      const account1 = {
        name: 'Defly Wallet 1',
        address: 'address1'
      }
      const account2 = {
        name: 'Defly Wallet 2',
        address: 'address2'
      }
      const walletState = {
        accounts: [account1],
        activeAccount: account1
      }

      addWallet(store, { walletId, wallet: walletState })

      const newAccounts = [account1, account2]
      const originalNewAccounts = [...newAccounts]

      setAccounts(store, { walletId, accounts: newAccounts })

      const storedWallet = store.state.wallets[walletId]

      // Check that new object references were created
      expect(storedWallet?.accounts).not.toBe(newAccounts)
      expect(storedWallet?.accounts[0]).not.toBe(account1)
      expect(storedWallet?.accounts[1]).not.toBe(account2)
      expect(storedWallet?.activeAccount).not.toBe(account1)

      // Check that the content is still correct
      expect(storedWallet?.accounts).toEqual([account1, account2])
      expect(storedWallet?.activeAccount).toEqual(account1)

      // Modify the stored accounts
      storedWallet!.accounts[0].name = 'Modified Name'

      // Check that the original new accounts array is unchanged
      expect(newAccounts).toEqual(originalNewAccounts)
    })
  })

  describe('setActiveNetwork', () => {
    it('should set the active network', () => {
      // Default network is testnet
      expect(store.state.activeNetwork).toBe('testnet')

      const networkId = 'mainnet'
      const algodClient = new Algodv2('', 'https://mainnet-api.4160.nodely.dev/')
      setActiveNetwork(store, { networkId, algodClient })
      expect(store.state.activeNetwork).toBe(networkId)
    })
  })
})

describe('Type Guards', () => {
  describe('isValidWalletId', () => {
    it('returns true for a valid WalletId', () => {
      expect(isValidWalletId(WalletId.DEFLY)).toBe(true)
    })

    it('returns false for an invalid WalletId', () => {
      expect(isValidWalletId('foo')).toBe(false)
    })
  })

  describe('isValidWalletAccount', () => {
    it('returns true for a valid WalletAccount', () => {
      expect(
        isValidWalletAccount({
          name: 'Defly Wallet 1',
          address: 'address'
        })
      ).toBe(true)
    })

    it('returns false for an invalid WalletAccount', () => {
      expect(isValidWalletAccount('foo')).toBe(false)
      expect(isValidWalletAccount(null)).toBe(false)

      expect(
        isValidWalletAccount({
          name: 'Defly Wallet 1',
          address: 123
        })
      ).toBe(false)

      expect(
        isValidWalletAccount({
          address: 'address'
        })
      ).toBe(false)
    })
  })

  describe('isValidWalletState', () => {
    it('returns true for a valid WalletState', () => {
      expect(
        isValidWalletState({
          accounts: [
            {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          ],
          activeAccount: {
            name: 'Defly Wallet 1',
            address: 'address'
          }
        })
      ).toBe(true)

      expect(
        isValidWalletState({
          accounts: [],
          activeAccount: null
        })
      ).toBe(true)
    })

    it('returns false for an invalid WalletState', () => {
      expect(isValidWalletState('foo')).toBe(false)
      expect(isValidWalletState(null)).toBe(false)
    })

    it('returns false if accounts is invalid', () => {
      expect(
        isValidWalletState({
          accounts: null,
          activeAccount: {
            name: 'Defly Wallet 1',
            address: 'address'
          }
        })
      ).toBe(false)

      expect(
        isValidWalletState({
          activeAccount: {
            name: 'Defly Wallet 1',
            address: 'address'
          }
        })
      ).toBe(false)
    })

    it('returns false if activeAccount is invalid', () => {
      expect(
        isValidWalletState({
          accounts: [
            {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          ],
          activeAccount: 'address'
        })
      ).toBe(false)

      expect(
        isValidWalletState({
          accounts: [
            {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          ]
        })
      ).toBe(false)
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

      const state: PersistedState = {
        wallets: {
          [WalletId.DEFLY]: {
            accounts: [
              {
                name: 'Defly Wallet 1',
                address: 'address'
              },
              {
                name: 'Defly Wallet 2',
                address: 'address'
              }
            ],
            activeAccount: {
              name: 'Defly Wallet 1',
              address: 'address'
            }
          },
          [WalletId.PERA]: {
            accounts: [
              {
                name: 'Pera Wallet 1',
                address: 'address'
              }
            ],
            activeAccount: {
              name: 'Pera Wallet 1',
              address: 'address'
            }
          }
        },
        activeWallet: WalletId.DEFLY,
        activeNetwork: 'testnet',
        customNetworkConfigs: {}
      }
      expect(isValidPersistedState(state)).toBe(true)
    })

    it('returns false for an invalid state', () => {
      expect(isValidPersistedState('foo')).toBe(false)
      expect(isValidPersistedState(null)).toBe(false)

      expect(
        isValidPersistedState({
          activeWallet: WalletId.DEFLY,
          activeNetwork: 'testnet'
        })
      ).toBe(false)

      expect(
        isValidPersistedState({
          wallets: {},
          activeNetwork: 'testnet'
        })
      ).toBe(false)

      expect(
        isValidPersistedState({
          wallets: {},
          activeWallet: WalletId.DEFLY
        })
      ).toBe(false)
    })
  })
})
