import { useStore } from '@tanstack/solid-store'
import algosdk from 'algosdk'
import { JSX, createContext, createMemo, onMount, useContext } from 'solid-js'
import type {
  AlgodConfig,
  NetworkId,
  WalletAccount,
  WalletId,
  WalletManager,
  WalletMetadata,
  WalletState
} from '@txnlab/use-wallet'

export * from '@txnlab/use-wallet'

interface WalletProviderProps {
  manager: WalletManager
  children: JSX.Element
}

const WalletContext = createContext<() => WalletManager>()

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

export const useWalletManager = (): WalletManager => {
  const manager = useContext(WalletContext)
  if (!manager) {
    throw new Error('useWalletManager must be used within a WalletProvider')
  }
  return manager()
}

export const useNetwork = () => {
  const manager = createMemo(() => useWalletManager())
  const activeNetwork = useStore(manager().store, (state) => state.activeNetwork)
  const activeNetworkConfig = createMemo(() => manager().networkConfig[activeNetwork()])

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork()) {
      return
    }

    if (!manager().networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Solid] Creating Algodv2 client for ${networkId}...`)

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

  const updateNetworkAlgod = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager().updateNetworkAlgod(networkId, config)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork()) {
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

    // If this is the active network, update the algodClient in store
    if (networkId === activeNetwork()) {
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
    networks: manager().networks,
    activeNetworkConfig,
    setActiveNetwork,
    updateNetworkAlgod,
    resetNetworkConfig
  }
}

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

export const useWallet = () => {
  const manager = createMemo(() => useWalletManager())

  const managerStatus = useStore(manager().store, (state) => state.managerStatus)
  const isReady = createMemo(() => managerStatus() === 'ready')
  const algodClient = useStore(manager().store, (state) => state.algodClient)

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

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
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
    wallets: manager().wallets,
    isReady,
    algodClient,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeWalletState,
    activeAccount,
    activeAddress,
    activeWalletId,
    walletStore,
    isWalletActive,
    isWalletConnected,
    signTransactions,
    transactionSigner
  }
}
