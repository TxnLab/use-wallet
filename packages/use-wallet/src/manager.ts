import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import {
  createDefaultNetworkConfig,
  isNetworkConfigMap,
  NetworkId,
  type AlgodConfig,
  type NetworkConfig,
  type NetworkConfigMap
} from 'src/network'
import { StorageAdapter } from 'src/storage'
import {
  defaultState,
  isValidState,
  LOCAL_STORAGE_KEY,
  removeWallet,
  setActiveNetwork,
  setActiveWallet,
  type State
} from 'src/store'
import { createWalletMap, deepMerge } from 'src/utils'
import type { BaseWallet } from 'src/wallets/base'
import type {
  SupportedWallet,
  WalletAccount,
  WalletConfigMap,
  WalletId,
  WalletIdConfig,
  WalletMetadata,
  WalletOptions
} from 'src/wallets/types'

export interface WalletManagerConfig {
  wallets?: SupportedWallet[]
  network?: NetworkId
  algod?: NetworkConfig
}

export class WalletManager {
  public _clients: Map<WalletId, BaseWallet> = new Map()

  public networkConfig: NetworkConfigMap
  public algodClient: algosdk.Algodv2

  public store: Store<State>
  public subscribe: (callback: (state: State) => void) => () => void

  constructor({ wallets = [], network = NetworkId.TESTNET, algod = {} }: WalletManagerConfig = {}) {
    const initialState = this.loadPersistedState() || {
      ...defaultState,
      activeNetwork: network
    }

    this.store = new Store<State>(initialState, {
      onUpdate: () => this.savePersistedState()
    })

    this.savePersistedState()

    this.subscribe = (callback: (state: State) => void): (() => void) => {
      const unsubscribe = this.store.subscribe(() => {
        callback(this.store.state)
      })

      return unsubscribe
    }

    this.networkConfig = this.initNetworkConfig(network, algod)
    this.algodClient = this.createAlgodClient(this.networkConfig[network])
    this.initializeWallets(wallets)
  }

  // ---------- Store ------------------------------------------------- //

  private loadPersistedState(): State | null {
    try {
      const serializedState = StorageAdapter.getItem(LOCAL_STORAGE_KEY)
      if (serializedState === null) {
        return null
      }
      const parsedState = JSON.parse(serializedState)
      if (!isValidState(parsedState)) {
        console.warn('[Store] Parsed state:', parsedState)
        throw new Error('Persisted state is invalid')
      }
      return parsedState as State
    } catch (error: any) {
      console.error(`[Store] Could not load state from local storage: ${error.message}`)
      return null
    }
  }

  private savePersistedState(): void {
    try {
      const state = this.store.state
      const serializedState = JSON.stringify(state)
      StorageAdapter.setItem(LOCAL_STORAGE_KEY, serializedState)
    } catch (error) {
      console.error('[Store] Could not save state to local storage:', error)
    }
  }

  // ---------- Wallets ----------------------------------------------- //

  private initializeWallets<T extends keyof WalletConfigMap>(
    walletsConfig: Array<T | WalletIdConfig<T>>
  ) {
    console.info('[Manager] Initializing wallets...')

    for (const walletConfig of walletsConfig) {
      let walletId: T
      let walletOptions: WalletOptions<T> | undefined
      let walletMetadata: Partial<WalletMetadata> | undefined

      // Parse wallet config
      if (typeof walletConfig === 'string') {
        walletId = walletConfig
      } else {
        const { id, options, metadata } = walletConfig
        walletId = id
        walletOptions = options
        walletMetadata = metadata
      }

      // Get wallet class
      const walletMap = createWalletMap()
      const WalletClass = walletMap[walletId]
      if (!WalletClass) {
        console.error(`[Manager] Wallet not found: ${walletId}`)
        continue
      }

      // Initialize wallet
      const walletInstance = new WalletClass({
        id: walletId,
        metadata: walletMetadata,
        options: walletOptions as any,
        getAlgodClient: this.getAlgodClient,
        store: this.store,
        subscribe: this.subscribe
      })

      this._clients.set(walletId, walletInstance)
      console.info(`[Manager] ✅ Initialized ${walletId}`)
    }

    const state = this.store.state

    // Check if connected wallets are still valid
    const connectedWallets = Object.keys(state.wallets) as WalletId[]
    for (const walletId of connectedWallets) {
      if (!this._clients.has(walletId)) {
        console.warn(`[Manager] Connected wallet not found: ${walletId}`)
        removeWallet(this.store, { walletId })
      }
    }

    // Check if active wallet is still valid
    if (state.activeWallet && !this._clients.has(state.activeWallet)) {
      console.warn(`[Manager] Active wallet not found: ${state.activeWallet}`)
      setActiveWallet(this.store, { walletId: null })
    }
  }

  public get wallets(): BaseWallet[] {
    return [...this._clients.values()]
  }

  public getWallet(walletId: WalletId): BaseWallet | undefined {
    return this._clients.get(walletId)
  }

  public async resumeSessions(): Promise<void> {
    const promises = this.wallets.map((wallet) => wallet?.resumeSession())
    await Promise.all(promises)
  }

  public async disconnect(): Promise<void> {
    const promises = this.wallets
      .filter((wallet) => wallet.isConnected)
      .map((wallet) => wallet?.disconnect())

    await Promise.all(promises)
  }

  // ---------- Network ----------------------------------------------- //

  private initNetworkConfig(network: NetworkId, config: NetworkConfig): NetworkConfigMap {
    console.info('[Manager] Initializing network...')

    let networkConfig = createDefaultNetworkConfig()

    if (isNetworkConfigMap(config)) {
      // Config for multiple networks
      networkConfig = deepMerge(networkConfig, config)
    } else {
      // Config for single (active) network
      networkConfig[network] = deepMerge(networkConfig[network], config)
    }

    console.info('[Manager] Algodv2 config:', networkConfig)

    return networkConfig
  }

  private createAlgodClient(config: AlgodConfig): algosdk.Algodv2 {
    console.info(`[Manager] Creating Algodv2 client for ${this.activeNetwork}...`)
    const { token = '', baseServer, port = '', headers = {} } = config
    return new algosdk.Algodv2(token, baseServer, port, headers)
  }

  public getAlgodClient = (): algosdk.Algodv2 => {
    return this.algodClient
  }

  public setActiveNetwork = async (networkId: NetworkId): Promise<void> => {
    if (this.activeNetwork === networkId) {
      return
    }

    setActiveNetwork(this.store, { networkId })
    this.algodClient = this.createAlgodClient(this.networkConfig[networkId])

    console.info(`[Manager] ✅ Active network set to ${networkId}.`)
  }

  public get activeNetwork(): NetworkId {
    return this.store.state.activeNetwork
  }

  // ---------- Active Wallet ----------------------------------------- //

  public get activeWallet(): BaseWallet | null {
    const state = this.store.state
    const activeWallet = this.wallets.find((wallet) => wallet.id === state.activeWallet)
    if (!activeWallet) {
      return null
    }

    return activeWallet
  }

  public get activeWalletAccounts(): WalletAccount[] | null {
    if (!this.activeWallet) {
      return null
    }
    return this.activeWallet.accounts
  }

  public get activeWalletAddresses(): string[] | null {
    if (!this.activeWallet) {
      return null
    }
    return this.activeWallet.accounts.map((account) => account.address)
  }

  public get activeAccount(): WalletAccount | null {
    if (!this.activeWallet) {
      return null
    }
    return this.activeWallet.activeAccount
  }

  public get activeAddress(): string | null {
    if (!this.activeAccount) {
      return null
    }
    return this.activeAccount.address
  }

  // ---------- Sign Transactions ------------------------------------- //

  public get signTransactions(): BaseWallet['signTransactions'] {
    if (!this.activeWallet) {
      throw new Error('[Manager] No active wallet found!')
    }
    return this.activeWallet.signTransactions
  }

  public get transactionSigner(): algosdk.TransactionSigner {
    if (!this.activeWallet) {
      throw new Error('[Manager] No active wallet found!')
    }
    return this.activeWallet.transactionSigner
  }
}
