import { useStore } from '@tanstack/solid-store'
import algosdk from 'algosdk'
import { createMemo, createSignal } from 'solid-js'
import { useWalletManager } from './WalletProvider'
import type {
  NetworkId,
  WalletAccount,
  WalletId,
  WalletMetadata,
  WalletState
} from '@txnlab/use-wallet'

export interface Wallet {
  id: () => string
  metadata: () => WalletMetadata
  accounts: () => WalletAccount[]
  activeAccount: () => WalletAccount | null
  isConnected: () => boolean
  isActive: () => boolean
  connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export function useWallet() {
  const manager = createMemo(() => useWalletManager())

  const [algodClient, setAlgodClient] = createSignal<algosdk.Algodv2>(manager().algodClient)

  const walletStore = useStore(manager().store, (state) => state.wallets)

  const walletState = (walletId: WalletId): WalletState | null => walletStore()[walletId] || null

  const activeWalletId = useStore(manager().store, (state) => state.activeWallet)

  const activeWallet = () => manager().getWallet(activeWalletId() as WalletId) || null

  const activeWalletState = () => walletState(activeWalletId() as WalletId)

  const activeWalletAccounts = () => activeWalletState()?.accounts ?? null

  const activeWalletAddresses = () =>
    activeWalletAccounts()?.map((account) => account.address) ?? null

  const activeAccount = () => activeWalletState()?.activeAccount ?? null

  const activeAddress = () => activeAccount()?.address ?? null

  const isWalletActive = (walletId: WalletId) => walletId === activeWalletId()
  const isWalletConnected = (walletId: WalletId) =>
    !!walletState(walletId)?.accounts.length || false

  const activeNetwork = useStore(manager().store, (state) => state.activeNetwork)

  const setActiveNetwork = (network: NetworkId) => {
    manager().setActiveNetwork(network)
    const { token, baseServer, port, headers } = manager().networkConfig[network]
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
    setAlgodClient(newClient)
  }

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<Uint8Array[]> => {
    const wallet = activeWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const wallet = activeWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    activeWalletId,
    walletStore,
    algodClient,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeWalletState,
    activeAccount,
    activeAddress,
    isWalletActive,
    isWalletConnected,
    setActiveNetwork,
    setAlgodClient,
    signTransactions,
    transactionSigner,
    wallets: manager().wallets
  }
}
