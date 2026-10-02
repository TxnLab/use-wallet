import { useStore } from '@tanstack/svelte-store'
import algosdk from 'algosdk'
import { getContext, setContext } from 'svelte'
import {
  type AlgodConfig,
  BaseWallet,
  NetworkId,
  type StdSignDataResponse,
  type StdSignMetadata,
  type WalletAccount,
  type WalletKey,
  WalletManager,
  type WalletMetadata
} from '@txnlab/use-wallet'

export * from '@txnlab/use-wallet'

export const useWalletContext = (manager: WalletManager<any>) => {
  setContext('walletManager', manager)

  manager.resumeSessions().catch((error) => {
    console.error('Error resuming sessions:', error)
  })
}

// Wagmi-style type registration: an app declares its manager type once,
// next to where the manager is created:
//
//   const manager = WalletManager.create({ wallets: [pqWallet(), classicWallet()] })
//   // or, with classic construction, declare the union explicitly:
//   // const manager = new WalletManager<PQAccount | ClassicAccount>({ wallets: [...] })
//
//   declare module '@txnlab/use-wallet-svelte' {
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

export const useWalletManager = (): ResolvedWalletManager => {
  const manager: WalletManager<any> = getContext('walletManager')
  if (!manager) {
    throw new Error('useWalletManager must be used within a useWalletContext')
  }
  return manager as ResolvedWalletManager
}

export const useNetwork = () => {
  const manager = useWalletManager()
  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)
  const activeNetworkConfig = useStore(
    manager.store,
    (state) => state.networkConfig[activeNetwork.current]
  )

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork.current) {
      return
    }

    if (!manager.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Svelte] Creating new Algodv2 client...`)

    const { algod } = manager.networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

    await manager.setActiveNetwork(networkId)

    manager.store.setState((state) => ({
      ...state,
      activeNetwork: networkId,
      algodClient: newClient
    }))

    console.info(`[Svelte] ✅ Active network set to ${networkId}.`)
  }

  const updateAlgodConfig = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager.updateAlgodConfig(networkId, config)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork.current) {
      console.info(`[Svelte] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager.store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  const resetNetworkConfig = (networkId: string): void => {
    manager.resetNetworkConfig(networkId)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork.current) {
      console.info(`[Svelte] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager.store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  return {
    activeNetwork,
    networkConfig: manager.networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  }
}

export interface Wallet<T extends WalletAccount = WalletAccount> {
  id: string
  walletKey: WalletKey
  metadata: WalletMetadata
  accounts: { current: T[] | undefined }
  isConnected: () => boolean
  isActive: () => boolean
  canSignData: boolean
  canUsePrivateKey: boolean
  connect: (args?: Record<string, any>) => Promise<T[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

// Internal implementation; the public hook binds `T` to the account type
// resolved from the app's `Register` declaration
const useWalletCore = <T extends WalletAccount = WalletAccount>() => {
  // The context erases the manager's generic; view it at the resolved
  // account type `T` so the store-derived state flows as `T`
  const manager = useWalletManager() as WalletManager<T>
  const walletStore = useStore(manager.store, (state) => state.wallets)

  const transformToWallet = (wallet: BaseWallet<any, any>): Wallet<T> => {
    return {
      id: wallet.id,
      walletKey: wallet.walletKey,
      metadata: wallet.metadata,
      accounts: useStore(manager.store, (state) => state.wallets[wallet.walletKey]?.accounts),
      isConnected: () => !!walletStore.current[wallet.walletKey],
      isActive: () => wallet.walletKey === activeWalletId.current,
      canSignData: wallet.canSignData ?? false,
      canUsePrivateKey: wallet.canUsePrivateKey ?? false,
      connect: (args) => wallet.connect(args),
      disconnect: () => wallet.disconnect(),
      setActive: () => wallet.setActive(),
      setActiveAccount: (addr) => wallet.setActiveAccount(addr)
    }
  }

  const wallets = [...manager.wallets].map(transformToWallet)
  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)
  const availableWallets = {
    get current() {
      // Access activeNetwork.current to ensure reactivity on network change
      void activeNetwork.current
      return wallets.filter((w) =>
        manager.availableWallets.some((aw) => aw.walletKey === w.walletKey)
      )
    }
  }
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)
  const managerStatus = useStore(manager.store, (state) => state.managerStatus)
  const isReady = () => managerStatus.current === 'ready'
  const algodClient = useStore(manager.store, (state) => state.algodClient)
  const activeWallet = () => wallets.find((w) => w.walletKey === activeWalletId.current)
  const activeWalletAccounts = useStore(
    manager.store,
    (state) => state.wallets[activeWalletId.current!]?.accounts
  )
  const activeWalletAddresses = useStore(manager.store, (state) =>
    state.wallets[activeWalletId.current!]?.accounts.map((account) => account.address)
  )
  const activeAccount = useStore(
    manager.store,
    (state) => state.wallets[activeWalletId.current!]?.activeAccount
  )
  const activeAddress = useStore(
    manager.store,
    (state) => state.wallets[activeWalletId.current!]?.activeAccount?.address
  )

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    const wallet = manager.wallets.find((w) => w.walletKey === activeWalletId.current)
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const wallet = manager.wallets.find((w) => w.walletKey === activeWalletId.current)
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.transactionSigner(txnGroup, indexesToSign)
  }

  const signData = (data: string, metadata: StdSignMetadata): Promise<StdSignDataResponse> => {
    const wallet = manager.wallets.find((w) => w.walletKey === activeWalletId.current)
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signData(data, metadata)
  }

  const withPrivateKey = <T>(callback: (secretKey: Uint8Array) => Promise<T>): Promise<T> => {
    const wallet = manager.wallets.find((w) => w.walletKey === activeWalletId.current)
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.withPrivateKey(callback)
  }

  return {
    wallets,
    availableWallets,
    isReady,
    algodClient,
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

export const useWallet = () => useWalletCore<ResolvedWalletAccount>()
