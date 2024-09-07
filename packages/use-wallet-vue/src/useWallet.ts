import { useStore } from '@tanstack/vue-store'
import {
  NetworkId,
  WalletManager,
  type WalletAccount,
  type WalletMetadata
} from 'avm-wallet'
import algosdk from 'algosdk'
import { computed, inject, ref } from 'vue'

export interface Wallet {
  id: string
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
  const setAlgodClient = inject<SetAlgodClient>('setAlgodClient') as SetAlgodClient

  if (!manager) {
    throw new Error('WalletManager plugin is not properly installed')
  }
  if (!algodClient || !setAlgodClient) {
    throw new Error('Algod client or setter not properly installed')
  }

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)
  const setActiveNetwork = async (networkId: NetworkId): Promise<void> => {
    if (networkId === activeNetwork.value) {
      return
    }

    console.info(`[Vue] Creating Algodv2 client for ${networkId}...`)

    const { token, baseServer, port, headers } = manager.networkConfig[networkId]
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
    setAlgodClient(newClient)

    manager.store.setState((state) => ({
      ...state,
      activeNetwork: networkId
    }))

    console.info(`[Vue] ✅ Active network set to ${networkId}.`)
  }

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
        connect: (args) => wallet.connect(args),
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

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!activeWallet.value) {
      throw new Error('No active wallet')
    }
    return activeWallet.value.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!activeWallet.value) {
      throw new Error('No active wallet')
    }
    return activeWallet.value.transactionSigner(txnGroup, indexesToSign)
  }

  return {
    wallets,
    algodClient: computed(() => {
      if (!algodClient.value) {
        throw new Error('Algod client is undefined')
      }
      return algodClient.value
    }),
    activeNetwork,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    setActiveNetwork,
    setAlgodClient,
    signTransactions,
    transactionSigner
  }
}
