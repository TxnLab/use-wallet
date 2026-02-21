import { useStore } from '@tanstack/react-store'
import {
  type AlgodConfig,
  type BaseWallet,
  NetworkId,
  SignDataResponse,
  SignMetadata,
  type WalletAccount,
  WalletId,
  type WalletKey,
  WalletManager,
  type WalletMetadata
} from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import * as React from 'react'

export * from '@txnlab/use-wallet'

interface IWalletContext {
  manager: WalletManager
  algodClient: algosdk.Algodv2
  setAlgodClient: React.Dispatch<React.SetStateAction<algosdk.Algodv2>>
}

const WalletContext = React.createContext<IWalletContext | undefined>(undefined)

interface WalletProviderProps {
  manager: WalletManager
  children: React.ReactNode
}

export const WalletProvider = ({ manager, children }: WalletProviderProps): JSX.Element => {
  const [algodClient, setAlgodClient] = React.useState(manager.algodClient)

  React.useEffect(() => {
    manager.algodClient = algodClient
  }, [algodClient, manager])

  const resumedRef = React.useRef(false)

  React.useEffect(() => {
    if (!resumedRef.current) {
      manager.resumeSessions()
      resumedRef.current = true
    }
  }, [manager])

  return (
    <WalletContext.Provider value={{ manager, algodClient, setAlgodClient }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useNetwork = () => {
  const context = React.useContext(WalletContext)

  if (!context) {
    throw new Error('useNetwork must be used within the WalletProvider')
  }

  const { manager, setAlgodClient } = context

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork) {
      return
    }

    if (!manager.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[React] Creating new Algodv2 client...`)

    const { algod } = manager.networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
    setAlgodClient(newClient)

    manager.store.setState((state) => ({
      ...state,
      activeNetwork: networkId
    }))

    console.info(`[React] ✅ Active network set to ${networkId}.`)
  }

  const updateAlgodConfig = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager.updateAlgodConfig(networkId, config)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork) {
      console.info(`[React] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
      setAlgodClient(newClient)
    }
  }

  const resetNetworkConfig = (networkId: string): void => {
    manager.resetNetworkConfig(networkId)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork) {
      console.info(`[React] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
      setAlgodClient(newClient)
    }
  }

  return {
    activeNetwork,
    networkConfig: manager.networkConfig,
    activeNetworkConfig: manager.activeNetworkConfig,
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
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean
  canSignData: boolean
  canUsePrivateKey: boolean
  connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}

export const useWallet = () => {
  const context = React.useContext(WalletContext)

  if (!context) {
    throw new Error('useWallet must be used within the WalletProvider')
  }

  const { manager, algodClient, setAlgodClient } = context

  const managerStatus = useStore(manager.store, (state) => state.managerStatus)
  const isReady = managerStatus === 'ready'

  const walletStateMap = useStore(manager.store, (state) => state.wallets)
  const activeWalletId = useStore(manager.store, (state) => state.activeWallet)

  const transformToWallet = React.useCallback(
    (wallet: BaseWallet): Wallet => {
      const walletState = walletStateMap[wallet.walletKey]
      return {
        id: wallet.id,
        walletKey: wallet.walletKey,
        metadata: wallet.metadata,
        accounts: walletState?.accounts ?? [],
        activeAccount: walletState?.activeAccount ?? null,
        isConnected: !!walletState,
        isActive: wallet.walletKey === activeWalletId,
        canSignData: wallet.canSignData ?? false,
        canUsePrivateKey: wallet.canUsePrivateKey ?? false,
        connect: (args) => wallet.connect(args),
        disconnect: () => wallet.disconnect(),
        setActive: () => wallet.setActive(),
        setActiveAccount: (addr) => wallet.setActiveAccount(addr)
      }
    },
    [walletStateMap, activeWalletId]
  )

  const wallets = React.useMemo(() => {
    return [...manager.wallets.values()].map(transformToWallet)
  }, [manager, transformToWallet])

  const activeBaseWallet = activeWalletId ? manager.getWallet(activeWalletId) || null : null
  const activeWallet = React.useMemo(() => {
    return activeBaseWallet ? transformToWallet(activeBaseWallet) : null
  }, [activeBaseWallet, transformToWallet])

  const activeWalletAccounts = activeWallet?.accounts ?? null
  const activeWalletAddresses = activeWalletAccounts?.map((account) => account.address) ?? null
  const activeAccount = activeWallet?.activeAccount ?? null
  const activeAddress = activeAccount?.address ?? null

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!activeBaseWallet) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!activeBaseWallet) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.transactionSigner(txnGroup, indexesToSign)
  }

  const signData = (data: string, metadata: SignMetadata): Promise<SignDataResponse> => {
    if (!activeBaseWallet) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.signData(data, metadata)
  }

  const withPrivateKey = <T,>(callback: (secretKey: Uint8Array) => Promise<T>): Promise<T> => {
    if (!activeBaseWallet) {
      throw new Error('No active wallet')
    }
    return activeBaseWallet.withPrivateKey(callback)
  }

  return {
    wallets,
    isReady,
    algodClient,
    setAlgodClient,
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
