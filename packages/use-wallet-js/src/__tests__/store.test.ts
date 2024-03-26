import { Store } from '@tanstack/store'
import { NetworkId } from 'src/network'
import {
  State,
  addWallet,
  defaultState,
  removeWallet,
  setAccounts,
  setActiveAccount,
  setActiveNetwork,
  setActiveWallet,
  isValidState,
  isValidWalletAccount,
  isValidWalletId,
  isValidWalletState
} from 'src/store'
import { WalletId } from 'src/wallets/types'

describe('Mutations', () => {
  let store: Store<State>

  beforeEach(() => {
    store = new Store<State>(defaultState)
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
  })

  describe('removeWallet', () => {
    beforeEach(() => {
      store = new Store<State>({
        ...defaultState,
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
  })

  describe('setActiveNetwork', () => {
    it('should set the active network', () => {
      // Default network is TESTNET
      expect(store.state.activeNetwork).toBe(NetworkId.TESTNET)

      const networkId = NetworkId.MAINNET
      setActiveNetwork(store, { networkId })
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

  describe('isValidState', () => {
    it('returns true for a valid state', () => {
      const defaultState: State = {
        wallets: {},
        activeWallet: null,
        activeNetwork: NetworkId.TESTNET
      }
      expect(isValidState(defaultState)).toBe(true)

      const state: State = {
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
        activeNetwork: NetworkId.TESTNET
      }
      expect(isValidState(state)).toBe(true)
    })

    it('returns false for an invalid state', () => {
      expect(isValidState('foo')).toBe(false)
      expect(isValidState(null)).toBe(false)

      expect(
        isValidState({
          activeWallet: WalletId.DEFLY,
          activeNetwork: NetworkId.TESTNET
        })
      ).toBe(false)

      expect(
        isValidState({
          wallets: {},
          activeNetwork: NetworkId.TESTNET
        })
      ).toBe(false)

      expect(
        isValidState({
          wallets: {},
          activeWallet: WalletId.DEFLY
        })
      ).toBe(false)
    })
  })
})
