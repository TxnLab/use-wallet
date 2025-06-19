import { useStore } from '@tanstack/svelte-store'
import algosdk from 'algosdk'
import { getContext, setContext } from 'svelte'
import {
  type AlgodConfig,
  NetworkId,
  type SignDataResponse,
  type SignMetadata,
  WalletId,
  WalletManager
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
  const activeNetworkObj = useStore(manager.store, (state) => state.activeNetwork)
  const activeNetwork = () => activeNetworkObj.current
  const networkConfigObj = useStore(manager.store, (state) => state.networkConfig)
  const activeNetworkConfig = () => networkConfigObj.current[activeNetwork()]

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork()) {
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
    if (networkId === activeNetwork()) {
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
    if (networkId === activeNetwork()) {
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
    networkConfig: () => manager.networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  }
}

export const useWallet = () => {
  const manager = useWalletManager()

  const managerStatusObj = useStore(manager.store, (state) => state.managerStatus)
  const managerStatus = () => managerStatusObj.current
  const isReady = () => managerStatus() === 'ready'
  const algodClient = () => manager.algodClient
  const walletStore = useStore(manager.store, (state) => state.wallets)
  const walletState = (walletId: WalletId) => walletStore.current[walletId] || null
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)
  const activeWallet = () => manager.getWallet(activeWalletId.current as WalletId) || null
  const activeWalletState = () => walletState(activeWalletId.current as WalletId)
  const activeWalletAccounts = () => activeWalletState()?.accounts ?? null
  const activeWalletAddresses = () =>
    activeWalletAccounts()?.map((account) => account.address) ?? null
  const activeAccount = () => activeWalletState()?.activeAccount ?? null
  const activeAddress = () => activeAccount()?.address ?? null
  const isWalletActive = (walletId: WalletId) => walletId === activeWalletId.current
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

  const signData = (data: string, metadata: SignMetadata): Promise<SignDataResponse> => {
    const wallet = activeWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signData(data, metadata)
  }

  return {
    wallets: manager.wallets,
    isReady,
    algodClient,
    activeWallet,
    activeWalletAccounts,
    activeWalletAddresses,
    activeAccount,
    activeAddress,
    isWalletActive,
    isWalletConnected,
    signData,
    signTransactions,
    transactionSigner
  }
}
