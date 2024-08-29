import { Algodv2 } from 'algosdk'
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
  algodClient: Algodv2
}

export const defaultState: State = {
  wallets: {},
  activeWallet: null,
  activeNetwork: NetworkId.TESTNET,
  algodClient: new Algodv2('', 'https://testnet-api.algonode.cloud/')
}

export const LOCAL_STORAGE_KEY = '@txnlab/use-wallet:v3'

// State mutations

export function addWallet(
  store: Store<State>,
  { walletId, wallet }: { walletId: WalletId; wallet: WalletState }
) {
  store.setState((state) => {
    const updatedWallets = {
      ...state.wallets,
      [walletId]: {
        accounts: wallet.accounts.map((account) => ({ ...account })),
        activeAccount: wallet.activeAccount ? { ...wallet.activeAccount } : null
      }
    }

    return {
      ...state,
      wallets: updatedWallets,
      activeWallet: walletId
    }
  })
}

export function removeWallet(store: Store<State>, { walletId }: { walletId: WalletId }) {
  store.setState((state) => {
    const updatedWallets = { ...state.wallets }
    delete updatedWallets[walletId]

    return {
      ...state,
      wallets: updatedWallets,
      activeWallet: state.activeWallet === walletId ? null : state.activeWallet
    }
  })
}

export function setActiveWallet(store: Store<State>, { walletId }: { walletId: WalletId | null }) {
  store.setState((state) => ({
    ...state,
    activeWallet: walletId
  }))
}

export function setActiveAccount(
  store: Store<State>,
  { walletId, address }: { walletId: WalletId; address: string }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      console.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newActiveAccount = wallet.accounts.find((a) => a.address === address)
    if (!newActiveAccount) {
      console.warn(`Account with address ${address} not found in wallet "${walletId}"`)
      return state
    }

    const updatedWallet = {
      ...wallet,
      accounts: wallet.accounts.map((account) => ({ ...account })),
      activeAccount: { ...newActiveAccount }
    }

    const updatedWallets = {
      ...state.wallets,
      [walletId]: updatedWallet
    }

    return {
      ...state,
      wallets: updatedWallets
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
      console.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newAccounts = accounts.map((account) => ({ ...account }))

    const isActiveAccountConnected = newAccounts.some(
      (account) => account.address === wallet.activeAccount?.address
    )

    const newActiveAccount = isActiveAccountConnected
      ? { ...wallet.activeAccount! }
      : newAccounts[0] || null

    const updatedWallet = {
      ...wallet,
      accounts: newAccounts,
      activeAccount: newActiveAccount
    }

    const updatedWallets = {
      ...state.wallets,
      [walletId]: updatedWallet
    }

    return {
      ...state,
      wallets: updatedWallets
    }
  })
}

export function setActiveNetwork(store: Store<State>, { networkId }: { networkId: NetworkId }) {
  store.setState((state) => ({
    ...state,
    activeNetwork: networkId
  }))
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
