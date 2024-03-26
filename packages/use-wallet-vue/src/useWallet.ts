import { useStore } from '@tanstack/vue-store'
import { WalletManager, type WalletAccount, type WalletMetadata } from '@txnlab/use-wallet-js'
import { computed, inject } from 'vue'
import type algosdk from 'algosdk'

export interface Wallet {
  id: string
  metadata: WalletMetadata
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean
  connect: () => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export function useWallet() {
  const manager = inject<WalletManager>('walletManager')

  if (!manager) {
    throw new Error('WalletManager plugin is not properly installed')
  }

  const algodClient: algosdk.Algodv2 = manager.algodClient

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)
  const setActiveNetwork = manager.setActiveNetwork

  const walletStateMap = useStore(manager.store, (state) => state.wallets)
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)

  const wallets = computed(() => {
    return [...manager.wallets.values()].map((wallet): Wallet => {
      const walletState = walletStateMap.value[wallet.id]

      return {
        id: wallet.id,
        metadata: wallet.metadata,
        accounts: walletState?.accounts ?? [],
        activeAccount: walletState?.activeAccount ?? null,
        isConnected: !!walletState,
        isActive: wallet.id === activeWalletId.value,
        connect: () => wallet.connect(),
        disconnect: () => wallet.disconnect(),
        setActive: () => wallet.setActive(),
        setActiveAccount: (addr) => wallet.setActiveAccount(addr)
      }
    })
  })

  const activeWallet = computed(() => {
    return activeWalletId.value ? manager.getWallet(activeWalletId.value) || null : null
  })

  const activeWalletState = computed(() => {
    const wallet = activeWallet.value
    return wallet ? walletStateMap.value[wallet.id] || null : null
  })

  const activeWalletAccounts = computed(() => {
    return activeWalletState.value?.accounts ?? null
  })

  const activeWalletAddresses = computed(() => {
    return activeWalletAccounts.value?.map((account) => account.address) ?? null
  })

  const activeAccount = computed(() => {
    return activeWalletState.value?.activeAccount ?? null
  })

  const activeAddress = computed(() => {
    return activeAccount.value?.address ?? null
  })

  const signTransactions = (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ) => {
    if (!activeWallet.value) {
      throw new Error('No active wallet')
    }
    return activeWallet.value.signTransactions(txnGroup, indexesToSign, returnGroup)
  }

  const transactionSigner = (txnGroup: algosdk.Transaction[], indexesToSign: number[]) => {
    if (!activeWallet.value) {
      throw new Error('No active wallet')
    }
    return activeWallet.value.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    wallets,
    algodClient,
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    setActiveNetwork,
    signTransactions,
    transactionSigner
  }
}
