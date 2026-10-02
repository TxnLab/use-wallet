import { useStore } from '@tanstack/vue-store'
import {
  BaseWallet,
  WalletManager,
  type Wallet,
  type WalletAccount,
  type StdSignMetadata,
  type StdSignDataResponse
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { computed, inject, ref } from 'vue'

export type SetAlgodClient = (client: algosdk.Algodv2) => void

// Wagmi-style type registration: an app declares its manager type once,
// next to where the manager is created:
//
//   const manager = WalletManager.create({ wallets: [pqWallet(), classicWallet()] })
//   // or, with classic construction, declare the union explicitly:
//   // const manager = new WalletManager<PQAccount | ClassicAccount>({ wallets: [...] })
//
//   declare module '@txnlab/use-wallet-vue' {
//     interface Register { manager: typeof manager }
//   }
//
// Every bare `useWallet()` then infers the manager's account union; apps
// that don't register keep the base `WalletAccount` default.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

export type ResolvedWalletManager<TRegister = Register> = TRegister extends {
  manager: infer TManager extends WalletManager<any>
}
  ? TManager
  : WalletManager

export type ResolvedWalletAccount<TRegister = Register> =
  ResolvedWalletManager<TRegister> extends WalletManager<infer TAccount> ? TAccount : WalletAccount

// Internal implementation; the public composable binds `T` to the account
// type resolved from the app's `Register` declaration
function useWalletCore<T extends WalletAccount = WalletAccount>() {
  // The injection erases the manager's generic; view it at the resolved
  // account type `T` so the store-derived state flows as `T`
  const manager = inject<WalletManager<T>>('walletManager')
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

  const transformToWallet = (wallet: BaseWallet<any, any>): Wallet<T> => {
    const walletState = walletStateMap.value[wallet.walletKey]
    return {
      id: wallet.id,
      walletKey: wallet.walletKey,
      metadata: wallet.metadata,
      accounts: walletState?.accounts ?? [],
      activeAccount: walletState?.activeAccount ?? null,
      isConnected: !!walletState,
      isActive: wallet.walletKey === activeWalletId.value,
      canSignData: wallet.canSignData ?? false,
      canUsePrivateKey: wallet.canUsePrivateKey ?? false,
      connect: (args) => wallet.connect(args),
      disconnect: () => wallet.disconnect(),
      setActive: () => wallet.setActive(),
      setActiveAccount: (addr) => wallet.setActiveAccount(addr)
    }
  }

  const wallets = computed(() => {
    return [...manager.wallets.values()].map(transformToWallet)
  })

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)

  const availableWallets = computed(() => {
    // Access activeNetwork.value to trigger recomputation on network change
    void activeNetwork.value
    return manager.availableWallets.map(transformToWallet)
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
    return wallet ? walletStateMap.value[wallet.walletKey] || null : null
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

  const signData = (data: string, metadata: StdSignMetadata): Promise<StdSignDataResponse> => {
    if (!activeBaseWallet.value) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.value.signData(data, metadata)
  }

  const withPrivateKey = <T>(callback: (secretKey: Uint8Array) => Promise<T>): Promise<T> => {
    if (!activeBaseWallet.value) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.value.withPrivateKey(callback)
  }

  return {
    wallets,
    availableWallets,
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
    signData,
    withPrivateKey,
    signTransactions,
    transactionSigner
  }
}

export function useWallet() {
  return useWalletCore<ResolvedWalletAccount>()
}
