import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { DEFAULT_NETWORK_CONFIG, NetworkConfig, NetworkId } from 'src/network'
import type { WalletAccount, WalletKey, WalletState } from 'src/wallets/types'
import type { Store } from '@tanstack/store'

export type { WalletState }

export type WalletStateMap<T extends WalletAccount = WalletAccount> = Partial<
  Record<WalletKey, WalletState<T>>
>

export type ManagerStatus = 'initializing' | 'ready'

export interface State<T extends WalletAccount = WalletAccount> {
  wallets: WalletStateMap<T>
  activeWallet: WalletKey | null
  activeNetwork: string
  algodClient: algosdk.Algodv2
  managerStatus: ManagerStatus
  networkConfig: Record<string, NetworkConfig>
  customNetworkConfigs: Record<string, Partial<NetworkConfig>>
}

export const DEFAULT_STATE = {
  wallets: {},
  activeWallet: null,
  activeNetwork: 'testnet',
  algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/'),
  managerStatus: 'initializing',
  networkConfig: DEFAULT_NETWORK_CONFIG,
  customNetworkConfigs: {}
} satisfies State

export type PersistedState<T extends WalletAccount = WalletAccount> = Omit<
  State<T>,
  'algodClient' | 'managerStatus' | 'networkConfig'
>

export const LOCAL_STORAGE_KEY = '@txnlab/use-wallet:v5'

// State mutations

export function addWallet<T extends WalletAccount>(
  store: Store<State<T>>,
  { walletId, wallet }: { walletId: WalletKey; wallet: WalletState<T> }
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

export function removeWallet<T extends WalletAccount>(
  store: Store<State<T>>,
  { walletId }: { walletId: WalletKey }
) {
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

export function setActiveWallet<T extends WalletAccount>(
  store: Store<State<T>>,
  { walletId }: { walletId: WalletKey | null }
) {
  store.setState((state) => ({
    ...state,
    activeWallet: walletId
  }))
}

export function setActiveAccount<T extends WalletAccount>(
  store: Store<State<T>>,
  { walletId, address }: { walletId: WalletKey; address: string }
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

export function setAccounts<T extends WalletAccount>(
  store: Store<State<T>>,
  { walletId, accounts }: { walletId: WalletKey; accounts: T[] }
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

export function setActiveNetwork<T extends WalletAccount>(
  store: Store<State<T>>,
  { networkId, algodClient }: { networkId: NetworkId | string; algodClient: algosdk.Algodv2 }
) {
  store.setState((state) => ({
    ...state,
    activeNetwork: networkId,
    algodClient
  }))
}

// Type guards

export function isValidWalletAccount<T extends WalletAccount = WalletAccount>(
  account: any
): account is T {
  return (
    typeof account === 'object' &&
    account !== null &&
    typeof account.name === 'string' &&
    typeof account.address === 'string'
  )
}

export function isValidWalletState<T extends WalletAccount = WalletAccount>(
  wallet: any
): wallet is WalletState<T> {
  return (
    typeof wallet === 'object' &&
    wallet !== null &&
    Array.isArray(wallet.accounts) &&
    wallet.accounts.every((account: any) => isValidWalletAccount(account)) &&
    (wallet.activeAccount === null || isValidWalletAccount(wallet.activeAccount))
  )
}

export function isValidPersistedState<T extends WalletAccount = WalletAccount>(
  state: unknown
): state is PersistedState<T> {
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
