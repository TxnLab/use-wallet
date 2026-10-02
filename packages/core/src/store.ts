import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { DEFAULT_NETWORK_CONFIG, NetworkConfig, NetworkId } from 'src/network'
import type { WalletAccount, WalletKey, WalletState } from 'src/wallets/types'
import type { Store } from '@tanstack/store'

export type { WalletState }

export type WalletStateMap = Partial<Record<WalletKey, WalletState>>

export type ManagerStatus = 'initializing' | 'ready'

export interface State {
  wallets: WalletStateMap
  activeWallet: WalletKey | null
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

export const LOCAL_STORAGE_KEY = '@txnlab/use-wallet:v5'

// State mutations

/**
 * Copies an account from an adapter, carrying over the auth address recorded
 * for its empty signature as long as the empty signature hasn't changed. A new
 * or changed empty signature has to be checked again.
 */
function withRecordedAuthAddr(
  account: WalletAccount,
  previousAccounts: WalletAccount[] | undefined
): WalletAccount {
  const { authAddr: _authAddr, ...copy } = account
  const previous = previousAccounts?.find((a) => a.address === account.address)
  if (
    copy.emptySignature !== undefined &&
    previous?.emptySignature === copy.emptySignature &&
    previous.authAddr !== undefined
  ) {
    return { ...copy, authAddr: previous.authAddr }
  }
  return copy
}

export function addWallet(
  store: Store<State>,
  { walletId, wallet }: { walletId: WalletKey; wallet: WalletState }
) {
  store.setState((state) => {
    const previousAccounts = state.wallets[walletId]?.accounts
    const accounts = wallet.accounts.map((account) =>
      withRecordedAuthAddr(account, previousAccounts)
    )
    const activeAccount = wallet.activeAccount
      ? (accounts.find((a) => a.address === wallet.activeAccount!.address) ??
        withRecordedAuthAddr(wallet.activeAccount, previousAccounts))
      : null

    const updatedWallets = {
      ...state.wallets,
      [walletId]: { accounts, activeAccount }
    }

    return {
      ...state,
      wallets: updatedWallets,
      activeWallet: walletId
    }
  })
}

export function removeWallet(store: Store<State>, { walletId }: { walletId: WalletKey }) {
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

export function setActiveWallet(store: Store<State>, { walletId }: { walletId: WalletKey | null }) {
  store.setState((state) => ({
    ...state,
    activeWallet: walletId
  }))
}

export function setActiveAccount(
  store: Store<State>,
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

export function setAccounts(
  store: Store<State>,
  { walletId, accounts }: { walletId: WalletKey; accounts: WalletAccount[] }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      logger.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newAccounts = accounts.map((account) => withRecordedAuthAddr(account, wallet.accounts))

    const newActiveAccount =
      newAccounts.find((account) => account.address === wallet.activeAccount?.address) ??
      newAccounts[0] ??
      null

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

export type EmptySignatureCheck = {
  address: string
  /** The empty signature that was checked */
  emptySignature: string
  /** The auth address to record, or `undefined` to clear the empty signature */
  authAddr: string | null | undefined
}

/**
 * Records the results of checking accounts' empty signatures against algod.
 * A result is ignored if the account's empty signature changed while it was
 * being checked.
 */
export function recordEmptySignatureChecks(
  store: Store<State>,
  { walletId, checks }: { walletId: WalletKey; checks: EmptySignatureCheck[] }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      return state
    }

    let changed = false
    const applyCheck = (account: WalletAccount): WalletAccount => {
      const check = checks.find(
        (c) => c.address === account.address && c.emptySignature === account.emptySignature
      )
      if (!check) {
        return account
      }
      changed = true
      if (check.authAddr === undefined) {
        const { emptySignature: _emptySignature, authAddr: _authAddr, ...rest } = account
        return rest
      }
      return { ...account, authAddr: check.authAddr }
    }

    const accounts = wallet.accounts.map(applyCheck)
    const activeAccount = wallet.activeAccount
      ? (accounts.find((a) => a.address === wallet.activeAccount!.address) ??
        applyCheck(wallet.activeAccount))
      : null

    if (!changed) {
      return state
    }

    return {
      ...state,
      wallets: {
        ...state.wallets,
        [walletId]: { ...wallet, accounts, activeAccount }
      }
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

export function isValidWalletAccount(account: any): account is WalletAccount {
  return (
    typeof account === 'object' &&
    account !== null &&
    typeof account.name === 'string' &&
    typeof account.address === 'string' &&
    (account.emptySignature === undefined || typeof account.emptySignature === 'string') &&
    (account.authAddr === undefined ||
      account.authAddr === null ||
      typeof account.authAddr === 'string')
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
