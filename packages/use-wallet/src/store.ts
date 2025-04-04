import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { DEFAULT_NETWORK_CONFIG, NetworkConfig, NetworkId } from 'src/network'
import { WalletId, type WalletAccount } from 'src/wallets/types'
import type { Store } from '@tanstack/store'

export type WalletState = {
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
}

export type WalletStateMap = Partial<Record<WalletId, WalletState>>

export type ManagerStatus = 'initializing' | 'ready'

export interface State {
  wallets: WalletStateMap
  activeWallet: WalletId | null
  activeNetwork: string
  algodClient: algosdk.Algodv2
  managerStatus: ManagerStatus
  networkConfig: Record<string, NetworkConfig>
  customNetworkConfigs: Record<string, Partial<NetworkConfig>>
}

export const DEFAULT_STATE: State = {
  wallets: {},
  activeWallet: null,
  activeNetwork: 'testnet',
  algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
  managerStatus: 'initializing',
  networkConfig: DEFAULT_NETWORK_CONFIG,
  customNetworkConfigs: {}
}

export type PersistedState = Omit<State, 'algodClient' | 'managerStatus' | 'networkConfig'>

export const LOCAL_STORAGE_KEY = '@txnlab/use-wallet:v4'

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
      logger.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newActiveAccount = wallet.accounts.find((a) => a.address === address)
    if (!newActiveAccount) {
      logger.warn(`Account with address ${address} not found in wallet "${walletId}"`)
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
      logger.warn(`Wallet with id "${walletId}" not found`)
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

export function setActiveNetwork(
  store: Store<State>,
  { networkId, algodClient }: { networkId: NetworkId | string; algodClient: algosdk.Algodv2 }
) {
  store.setState((state) => ({
    ...state,
    activeNetwork: networkId,
    algodClient
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

export function isValidPersistedState(state: unknown): state is PersistedState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'wallets' in state &&
    'activeWallet' in state &&
    'activeNetwork' in state &&
    (!('customNetworkConfigs' in state) ||
      (typeof state.customNetworkConfigs === 'object' && state.customNetworkConfigs !== null))
  )
}
