import { useStore } from '@tanstack/vue-store'
import {
  BaseWallet,
  WalletManager,
  type WalletAccount,
  type WalletMetadata,
  type WalletId
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { computed, inject, ref } from 'vue'

export interface Wallet {
  id: WalletId
  metadata: WalletMetadata
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean
  connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export type SetAlgodClient = (client: algosdk.Algodv2) => void

export function useWallet() {
  const manager = inject<WalletManager>('walletManager')
  const algodClient = inject<ReturnType<typeof ref<algosdk.Algodv2>>>('algodClient')

  if (!manager) {
    throw new Error('WalletManager plugin is not properly installed')
  }
  if (!algodClient) {
    throw new Error('Algod client not properly installed')
  }

  const managerStatus = useStore(manager.store, (state) => state.managerStatus)
  const isReady = computed(() => managerStatus.value === 'ready')

  const walletStateMap = useStore(manager.store, (state) => state.wallets)
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)

  const transformToWallet = (wallet: BaseWallet): Wallet => {
    const walletState = walletStateMap.value[wallet.id]
    return {
      id: wallet.id,
      metadata: wallet.metadata,
      accounts: walletState?.accounts ?? [],
      activeAccount: walletState?.activeAccount ?? null,
      isConnected: !!walletState,
      isActive: wallet.id === activeWalletId.value,
      connect: (args) => wallet.connect(args),
      disconnect: () => wallet.disconnect(),
      setActive: () => wallet.setActive(),
      setActiveAccount: (addr) => wallet.setActiveAccount(addr)
    }
  }

  const wallets = computed(() => {
    return [...manager.wallets.values()].map(transformToWallet)
  })

  const activeWallet = computed(() => {
    const wallet = activeWalletId.value ? manager.getWallet(activeWalletId.value) || null : null
    return wallet ? transformToWallet(wallet) : null
  })

  const activeBaseWallet = computed(() => {
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

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!activeBaseWallet.value) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.value.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!activeBaseWallet.value) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.value.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    wallets,
    isReady,
    algodClient: computed(() => {
      if (!algodClient.value) {
        throw new Error('Algod client is undefined')
      }
      return algodClient.value
    }),
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    signTransactions,
    transactionSigner
  }
}
