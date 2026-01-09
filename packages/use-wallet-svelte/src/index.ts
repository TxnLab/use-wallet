import { useStore } from '@tanstack/svelte-store'
import algosdk from 'algosdk'
import { getContext, setContext } from 'svelte'
import {
  type AlgodConfig,
  BaseWallet,
  NetworkId,
  type SignDataResponse,
  type SignMetadata,
  WalletAccount,
  WalletId,
  type WalletKey,
  WalletManager,
  WalletMetadata
} from '@txnlab/use-wallet'

export * from '@txnlab/use-wallet'

export const useWalletContext = (manager: WalletManager) => {
  setContext('walletManager', manager)

  manager.resumeSessions().catch((error) => {
    console.error('Error resuming sessions:', error)
  })
}

export const useWalletManager = (): WalletManager => {
  const manager: WalletManager = getContext('walletManager')
  if (!manager) {
    throw new Error('useWalletManager must be used within a useWalletContext')
  }
  return manager
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

export interface Wallet {
  id: WalletId
  /** Unique key for this wallet instance. Used for skinned WalletConnect instances. */
  walletKey: WalletKey
  metadata: WalletMetadata
  accounts: { current: WalletAccount[] | undefined }
  isConnected: () => boolean
  isActive: () => boolean
  canSignData: boolean
  connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export const useWallet = () => {
  const manager = useWalletManager()
  const walletStore = useStore(manager.store, (state) => state.wallets)

  const transformToWallet = (wallet: BaseWallet): Wallet => {
    return {
      id: wallet.id,
      walletKey: wallet.walletKey,
      metadata: wallet.metadata,
      accounts: useStore(manager.store, (state) => state.wallets[wallet.walletKey]?.accounts),
      isConnected: () => !!walletStore.current[wallet.walletKey],
      isActive: () => wallet.walletKey === activeWalletId.current,
      canSignData: wallet.canSignData ?? false,
      connect: (args) => wallet.connect(args),
      disconnect: () => wallet.disconnect(),
      setActive: () => wallet.setActive(),
      setActiveAccount: (addr) => wallet.setActiveAccount(addr)
    }
  }

  const wallets = [...manager.wallets].map(transformToWallet)
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

  const signData = (data: string, metadata: SignMetadata): Promise<SignDataResponse> => {
    const wallet = manager.wallets.find((w) => w.walletKey === activeWalletId.current)
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signData(data, metadata)
  }

  return {
    wallets,
    isReady,
    algodClient,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    signData,
    signTransactions,
    transactionSigner
  }
}
