/**
 * @txnlab/use-wallet/testing
 *
 * Test helpers for wallet adapter test suites. Reduces boilerplate
 * for both internal and external adapter maintainers.
 */

import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import {
  addWallet,
  removeWallet,
  setAccounts,
  setActiveAccount,
  setActiveWallet,
  DEFAULT_STATE,
  type State
} from './store'
import type { AdapterStoreAccessor, WalletState } from './wallets/types'

/**
 * Create a test store with optional state overrides.
 */
export function createTestStore(overrides?: Partial<State>): Store<State> {
  return new Store<State>({
    ...DEFAULT_STATE,
    ...overrides
  })
}

/**
 * Create a mock Algodv2 client for testing.
 */
export function createMockAlgodClient(): algosdk.Algodv2 {
  return new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/')
}

/**
 * Create a mock AdapterStoreAccessor bound to a wallet key.
 * Optionally override individual methods.
 */
export function createMockStoreAccessor(
  walletKey: string,
  overrides?: Partial<AdapterStoreAccessor>
): AdapterStoreAccessor {
  const store = createTestStore()

  const defaultAccessor: AdapterStoreAccessor = {
    getWalletState: () => store.state.wallets[walletKey],
    getActiveWallet: () => store.state.activeWallet,
    getActiveNetwork: () => store.state.activeNetwork,
    getState: () => store.state,
    addWallet: (wallet: WalletState) => addWallet(store, { walletId: walletKey, wallet }),
    removeWallet: () => removeWallet(store, { walletId: walletKey }),
    setAccounts: (accounts) => setAccounts(store, { walletId: walletKey, accounts }),
    setActiveAccount: (address) => setActiveAccount(store, { walletId: walletKey, address }),
    setActive: () => setActiveWallet(store, { walletId: walletKey })
  }

  return { ...defaultAccessor, ...overrides }
}

/**
 * Test harness for wallet adapter tests.
 * Returns both the store accessor and the underlying store,
 * allowing tests to pre-populate state and verify mutations.
 */
export function createTestHarness(
  walletKey: string,
  stateOverrides?: Partial<State>
): { store: Store<State>; accessor: AdapterStoreAccessor } {
  const store = createTestStore(stateOverrides)

  const accessor: AdapterStoreAccessor = {
    getWalletState: () => store.state.wallets[walletKey],
    getActiveWallet: () => store.state.activeWallet,
    getActiveNetwork: () => store.state.activeNetwork,
    getState: () => store.state,
    addWallet: (wallet: WalletState) => addWallet(store, { walletId: walletKey, wallet }),
    removeWallet: () => removeWallet(store, { walletId: walletKey }),
    setAccounts: (accounts) => setAccounts(store, { walletId: walletKey, accounts }),
    setActiveAccount: (address) => setActiveAccount(store, { walletId: walletKey, address }),
    setActive: () => setActiveWallet(store, { walletId: walletKey })
  }

  return { store, accessor }
}

// Re-export commonly needed test types
export type { State } from './store'
export type { AdapterStoreAccessor, WalletState, WalletAccount } from './wallets/types'

// Re-export Store type so adapter tests don't need a direct @tanstack/store dependency
export type { Store } from '@tanstack/store'
