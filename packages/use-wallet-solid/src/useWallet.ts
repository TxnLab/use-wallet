import { useStore } from '@tanstack/solid-store'
import { createMemo } from 'solid-js'
import { useWalletManager } from './WalletProvider'
import type { NetworkId, WalletAccount, WalletId, WalletMetadata } from '@txnlab/use-wallet'
import type algosdk from 'algosdk'

export interface Wallet {
  id: () => string
  metadata: () => WalletMetadata
  accounts: () => WalletAccount[]
  activeAccount: () => WalletAccount | null
  isConnected: () => boolean
  isActive: () => boolean
  connect: () => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export function useWallet() {
  const manager = createMemo(() => useWalletManager())

  const walletStateMap = useStore(manager().store, (state) => {
    return state.wallets
  })

  const activeWalletId = useStore(manager().store, (state) => {
    return state.activeWallet
  })

  const activeWallet = () =>
    activeWalletId() !== null ? manager().getWallet(activeWalletId() as WalletId) || null : null

  const activeWalletState = () =>
    activeWalletId() !== null ? walletStateMap()[activeWalletId() as WalletId] || null : null

  const activeWalletAccounts = () => activeWalletState()?.accounts ?? null

  const activeWalletAddresses = () =>
    activeWalletAccounts()?.map((account) => account.address) ?? null

  const activeAccount = () => activeWalletState()?.activeAccount ?? null

  const activeAddress = () => activeAccount()?.address ?? null

  const activeNetworkState = createMemo(() => {
    return useStore(manager().store, (state) => state.activeNetwork)
  })

  // Returning a function to access the current value allows for lazy evaluation
  // while ensuring the use of `createMemo` above keeps the reactivity intact.
  const activeNetwork = () => activeNetworkState()()

  const setActiveNetwork = (network: NetworkId) => manager().setActiveNetwork(network)

  // @todo: Not reactive when intDecoding is changed
  const algodClient = createMemo(() => manager().algodClient)

  const signTransactions = (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ) => {
    if (!activeWallet) {
      throw new Error('No active wallet')
    }
    return activeWallet()?.signTransactions(txnGroup, indexesToSign, returnGroup)
  }

  const transactionSigner = (txnGroup: algosdk.Transaction[], indexesToSign: number[]) => {
    if (!activeWallet) {
      throw new Error('No active wallet')
    }
    return activeWallet()?.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    activeWalletId,
    walletStateMap,
    algodClient,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeWalletState,
    activeAccount,
    activeAddress,
    setActiveNetwork,
    signTransactions,
    transactionSigner,
    wallets: manager().wallets
  }
}
