import { NetworkId, isValidNetworkId } from 'src/network'
import { WalletId, type WalletAccount } from 'src/wallets'
import type { Store } from '@tanstack/store'

export type WalletState = {
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
}

export type WalletStateMap = Partial<Record<WalletId, WalletState>>

export interface State {
  wallets: WalletStateMap
  activeWallet: WalletId | null
  activeNetwork: NetworkId
}

export const defaultState: State = {
  wallets: {},
  activeWallet: null,
  activeNetwork: NetworkId.TESTNET
}

export const LOCAL_STORAGE_KEY = '@txnlab/use-wallet-js'

// State mutations

export function addWallet(
  store: Store<State>,
  { walletId, wallet }: { walletId: WalletId; wallet: WalletState }
) {
  store.setState((state) => {
    const newWallets = {
      ...state.wallets,
      [walletId]: wallet
    }

    return {
      ...state,
      wallets: newWallets,
      activeWallet: walletId
    }
  })
}

export function removeWallet(store: Store<State>, { walletId }: { walletId: WalletId }) {
  store.setState((state) => {
    const newWallets = { ...state.wallets }
    delete newWallets[walletId]

    return {
      ...state,
      wallets: newWallets,
      activeWallet: state.activeWallet === walletId ? null : state.activeWallet
    }
  })
}

export function setActiveWallet(store: Store<State>, { walletId }: { walletId: WalletId | null }) {
  store.setState((state) => {
    return {
      ...state,
      activeWallet: walletId
    }
  })
}

export function setActiveAccount(
  store: Store<State>,
  { walletId, address }: { walletId: WalletId; address: string }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      return state
    }
    const activeAccount = wallet.accounts.find((a) => a.address === address)
    if (!activeAccount) {
      return state
    }

    const newWallets = {
      ...state.wallets,
      [walletId]: {
        ...wallet,
        activeAccount
      }
    }

    return {
      ...state,
      wallets: newWallets
    }
  })
}

export function setAccounts(
  store: Store<State>,
  { walletId, accounts }: { walletId: WalletId; accounts: WalletAccount[] }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      return state
    }

    // Check if `accounts` includes `wallet.activeAccount`
    const isActiveAccountConnected = accounts.some(
      (account) => account.address === wallet.activeAccount?.address
    )

    const activeAccount = isActiveAccountConnected ? wallet.activeAccount! : accounts[0] || null

    const newWallet = {
      ...wallet,
      accounts,
      activeAccount
    }

    // Create a new map with the updated wallet
    const newWallets = {
      ...state.wallets,
      [walletId]: newWallet
    }

    return {
      ...state,
      wallets: newWallets
    }
  })
}

export function setActiveNetwork(store: Store<State>, { networkId }: { networkId: NetworkId }) {
  store.setState((state) => {
    return {
      ...state,
      activeNetwork: networkId
    }
  })
}

// Type guards

export function isValidWalletId(walletId: any): walletId is WalletId {
  return Object.values(WalletId).includes(walletId)
}

export function isValidWalletAccount(account: any): account is WalletAccount {
  return (
    typeof account === 'object' &&
    account !== null &&
    typeof account.name === 'string' &&
    typeof account.address === 'string'
  )
}

export function isValidWalletState(wallet: any): wallet is WalletState {
  return (
    typeof wallet === 'object' &&
    wallet !== null &&
    Array.isArray(wallet.accounts) &&
    wallet.accounts.every(isValidWalletAccount) &&
    (wallet.activeAccount === null || isValidWalletAccount(wallet.activeAccount))
  )
}

export function isValidState(state: any): state is State {
  if (!state || typeof state !== 'object') return false
  if (typeof state.wallets !== 'object') return false
  for (const [walletId, wallet] of Object.entries(state.wallets)) {
    if (!isValidWalletId(walletId) || !isValidWalletState(wallet)) return false
  }
  if (state.activeWallet !== null && !isValidWalletId(state.activeWallet)) return false
  if (!isValidNetworkId(state.activeNetwork)) return false

  return true
}
