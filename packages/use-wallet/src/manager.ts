import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { Logger, LogLevel, logger } from 'src/logger'
import {
  createDefaultNetworkConfig,
  isNetworkConfigMap,
  NetworkId,
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
  options?: {
    resetNetwork?: boolean
    debug?: boolean
    logLevel?: LogLevel
  }
}

export type PersistedState = Omit<State, 'algodClient'>

export class WalletManager {
  public _clients: Map<WalletId, BaseWallet> = new Map()

  public networkConfig: NetworkConfigMap

  public store: Store<State>
  public subscribe: (callback: (state: State) => void) => () => void

  public options: { resetNetwork: boolean }

  private logger: ReturnType<typeof logger.createScopedLogger>

  constructor({
    wallets = [],
    network = NetworkId.TESTNET,
    algod = {},
    options = {}
  }: WalletManagerConfig = {}) {
    const logLevel = options.debug ? LogLevel.DEBUG : options.logLevel || LogLevel.WARN

    Logger.setLevel(logLevel)
    this.logger = logger.createScopedLogger('WalletManager')

    this.logger.debug('Initializing WalletManager with options:', options)

    // Initialize network config
    this.networkConfig = this.initNetworkConfig(network, algod)

    // Initialize options
    this.options = { resetNetwork: options.resetNetwork || false }

    // Load persisted state from local storage
    const persistedState = this.loadPersistedState()

    // Set active network
    const activeNetwork = this.options.resetNetwork
      ? network
      : persistedState?.activeNetwork || network

    // Create Algod client for active network
    const algodClient = this.createAlgodClient(activeNetwork)

    // Create initial state
    const initialState: State = {
      ...defaultState,
      ...persistedState,
      activeNetwork,
      algodClient
    }

    // Create store
    this.store = new Store<State>(initialState, {
      onUpdate: () => this.savePersistedState()
    })

    // Save persisted state immediately
    this.savePersistedState()

    // Subscribe to store updates
    this.subscribe = (callback: (state: State) => void): (() => void) => {
      const unsubscribe = this.store.subscribe(() => {
        callback(this.store.state)
      })

      return unsubscribe
    }

    // Initialize wallets
    this.initializeWallets(wallets)
  }

  // ---------- Store ------------------------------------------------- //

  public get algodClient(): algosdk.Algodv2 {
    return this.store.state.algodClient
  }

  public set algodClient(algodClient: algosdk.Algodv2) {
    this.store.setState((state) => ({
      ...state,
      algodClient
    }))
  }

  private loadPersistedState(): PersistedState | null {
    try {
      const serializedState = StorageAdapter.getItem(LOCAL_STORAGE_KEY)
      if (serializedState === null) {
        return null
      }
      const parsedState = JSON.parse(serializedState)
      if (!isValidState(parsedState)) {
        this.logger.warn('Parsed state:', parsedState)
        throw new Error('Persisted state is invalid')
      }
      return parsedState as PersistedState
    } catch (error: any) {
      this.logger.error(`Could not load state from local storage: ${error.message}`)
      return null
    }
  }

  private savePersistedState(): void {
    try {
      const { wallets, activeWallet, activeNetwork } = this.store.state
      const persistedState: PersistedState = { wallets, activeWallet, activeNetwork }
      const serializedState = JSON.stringify(persistedState)
      StorageAdapter.setItem(LOCAL_STORAGE_KEY, serializedState)
    } catch (error) {
      this.logger.error('Could not save state to local storage:', error)
    }
  }

  // ---------- Wallets ----------------------------------------------- //

  private initializeWallets<T extends keyof WalletConfigMap>(
    walletsConfig: Array<T | WalletIdConfig<T>>
  ) {
    this.logger.info('Initializing wallets...')

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
        this.logger.error(`Wallet not found: ${walletId}`)
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
      this.logger.info(`✅ Initialized ${walletId}`)
    }

    const state = this.store.state

    // Check if connected wallets are still valid
    const connectedWallets = Object.keys(state.wallets) as WalletId[]
    for (const walletId of connectedWallets) {
      if (!this._clients.has(walletId)) {
        this.logger.warn(`Connected wallet not found: ${walletId}`)
        removeWallet(this.store, { walletId })
      }
    }

    // Check if active wallet is still valid
    if (state.activeWallet && !this._clients.has(state.activeWallet)) {
      this.logger.warn(`Active wallet not found: ${state.activeWallet}`)
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
    this.logger.info('Initializing network...')

    let networkConfig = createDefaultNetworkConfig()

    if (isNetworkConfigMap(config)) {
      // Config for multiple networks
      networkConfig = deepMerge(networkConfig, config)
    } else {
      // Config for single (active) network
      networkConfig[network] = deepMerge(networkConfig[network], config)
    }

    this.logger.debug('Algodv2 config:', networkConfig)

    return networkConfig
  }

  private createAlgodClient(networkId: NetworkId): algosdk.Algodv2 {
    this.logger.info(`Creating Algodv2 client for ${networkId}...`)
    const { token = '', baseServer, port = '', headers = {} } = this.networkConfig[networkId]
    return new algosdk.Algodv2(token, baseServer, port, headers)
  }

  public getAlgodClient = (): algosdk.Algodv2 => {
    return this.algodClient
  }

  public setActiveNetwork = async (networkId: NetworkId): Promise<void> => {
    if (this.activeNetwork === networkId) {
      return
    }

    const algodClient = this.createAlgodClient(networkId)
    setActiveNetwork(this.store, { networkId, algodClient })

    this.logger.info(`✅ Active network set to ${networkId}.`)
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
      this.logger.error('No active wallet found!')
      throw new Error('No active wallet found!')
    }
    return this.activeWallet.signTransactions
  }

  public get transactionSigner(): algosdk.TransactionSigner {
    if (!this.activeWallet) {
      this.logger.error('No active wallet found!')
      throw new Error('No active wallet found!')
    }
    return this.activeWallet.transactionSigner
  }
}
