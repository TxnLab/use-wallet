import { useStore } from '@tanstack/solid-store'
import algosdk from 'algosdk'
import { JSX, createContext, createMemo, onMount, useContext } from 'solid-js'
import type {
  AlgodConfig,
  BaseWallet,
  NetworkId,
  StdSignDataResponse,
  StdSignMetadata,
  WalletAccount,
  WalletManager,
  WalletMetadata,
  WalletKey
} from '@txnlab/use-wallet'

export * from '@txnlab/use-wallet'

export interface Wallet<T extends WalletAccount = WalletAccount> {
  id: string
  walletKey: WalletKey
  metadata: WalletMetadata
  readonly accounts: T[]
  readonly activeAccount: T | null
  readonly isConnected: boolean
  readonly isActive: boolean
  canSignData: boolean
  canUsePrivateKey: boolean
  connect: (args?: Record<string, any>) => Promise<T[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

interface WalletProviderProps {
  manager: WalletManager<any>
  children: JSX.Element
}

const WalletContext = createContext<() => WalletManager<any>>()

export const WalletProvider = (props: WalletProviderProps): JSX.Element => {
  const store = () => props.manager

  onMount(async () => {
    try {
      await props.manager.resumeSessions()
    } catch (error) {
      console.error('Error resuming sessions:', error)
    }
  })

  return <WalletContext.Provider value={store}>{props.children}</WalletContext.Provider>
}

// Wagmi-style type registration: an app declares its manager type once,
// next to where the manager is created:
//
//   const manager = WalletManager.create({ wallets: [pqWallet(), classicWallet()] })
//   // or, with classic construction, declare the union explicitly:
//   // const manager = new WalletManager<PQAccount | ClassicAccount>({ wallets: [...] })
//
//   declare module '@txnlab/use-wallet-solid' {
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
  const manager = useContext(WalletContext)
  if (!manager) {
    throw new Error('useWalletManager must be used within a WalletProvider')
  }
  return manager() as ResolvedWalletManager
}

export const useNetwork = () => {
  const manager = createMemo(() => useWalletManager())
  const activeNetwork = useStore(manager().store, (state) => state.activeNetwork)
  const activeNetworkConfig = () => {
    const store = useStore(manager().store)
    return store().networkConfig[activeNetwork()]
  }

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork()) {
      return
    }

    if (!manager().networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Solid] Creating new Algodv2 client...`)

    const { algod } = manager().networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

    await manager().setActiveNetwork(networkId)

    manager().store.setState((state) => ({
      ...state,
      activeNetwork: networkId,
      algodClient: newClient
    }))

    console.info(`[Solid] ✅ Active network set to ${networkId}.`)
  }

  const updateAlgodConfig = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager().updateAlgodConfig(networkId, config)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork()) {
      console.info(`[Solid] Creating new Algodv2 client...`)
      const { algod } = manager().networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager().store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  const resetNetworkConfig = (networkId: string): void => {
    manager().resetNetworkConfig(networkId)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork()) {
      console.info(`[Solid] Creating new Algodv2 client...`)
      const { algod } = manager().networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager().store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  return {
    activeNetwork,
    networkConfig: () => manager().networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  }
}

// Internal implementation; the public hook binds `T` to the account type
// resolved from the app's `Register` declaration
const useWalletCore = <T extends WalletAccount = WalletAccount>() => {
  // The context erases the manager's generic; view it at the resolved
  // account type `T` so the store-derived state flows as `T`
  const manager = createMemo(() => useWalletManager() as WalletManager<T>)

  const managerStatus = useStore(manager().store, (state) => state.managerStatus)
  const isReady = createMemo(() => managerStatus() === 'ready')
  const algodClient = useStore(manager().store, (state) => state.algodClient)

  const walletStateMap = useStore(manager().store, (state) => state.wallets)
  const activeWalletId = useStore(manager().store, (state) => state.activeWallet)

  const transformToWallet = (wallet: BaseWallet<any, any>): Wallet<T> => {
    return {
      id: wallet.id,
      walletKey: wallet.walletKey,
      metadata: wallet.metadata,
      get accounts() {
        return walletStateMap()[wallet.walletKey]?.accounts ?? []
      },
      get activeAccount() {
        return walletStateMap()[wallet.walletKey]?.activeAccount ?? null
      },
      get isConnected() {
        return !!walletStateMap()[wallet.walletKey]
      },
      get isActive() {
        return wallet.walletKey === activeWalletId()
      },
      canSignData: wallet.canSignData ?? false,
      canUsePrivateKey: wallet.canUsePrivateKey ?? false,
      connect: (args) => wallet.connect(args),
      disconnect: () => wallet.disconnect(),
      setActive: () => wallet.setActive(),
      setActiveAccount: (addr) => wallet.setActiveAccount(addr)
    }
  }

  const wallets = [...manager().wallets].map(transformToWallet)

  const activeNetwork = useStore(manager().store, (state) => state.activeNetwork)

  const availableWallets = createMemo(() => {
    // Access activeNetwork() to trigger recomputation on network change
    void activeNetwork()
    return wallets.filter((w) =>
      manager().availableWallets.some((aw) => aw.walletKey === w.walletKey)
    )
  })

  const activeBaseWallet = createMemo(() => {
    const id = activeWalletId()
    return id ? manager().getWallet(id) || null : null
  })

  const activeWallet = createMemo(() => {
    const id = activeWalletId()
    return id ? (wallets.find((w) => w.walletKey === id) ?? null) : null
  })

  const activeWalletAccounts = createMemo(() => {
    const state = walletStateMap()[activeWalletId()!]
    return state?.accounts ?? null
  })
  const activeWalletAddresses = createMemo(
    () => activeWalletAccounts()?.map((account) => account.address) ?? null
  )
  const activeAccount = createMemo(() => {
    const state = walletStateMap()[activeWalletId()!]
    return state?.activeAccount ?? null
  })
  const activeAddress = createMemo(() => activeAccount()?.address ?? null)

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    const wallet = activeBaseWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const wallet = activeBaseWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.transactionSigner(txnGroup, indexesToSign)
  }

  const signData = (data: string, metadata: StdSignMetadata): Promise<StdSignDataResponse> => {
    const wallet = activeBaseWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signData(data, metadata)
  }

  const withPrivateKey = <T,>(callback: (secretKey: Uint8Array) => Promise<T>): Promise<T> => {
    const wallet = activeBaseWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.withPrivateKey(callback)
  }

  return {
    wallets: () => wallets,
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
