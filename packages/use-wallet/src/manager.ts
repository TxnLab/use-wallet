import { Store } from '@tanstack/store'
import algosdk from 'algosdk'
import { Logger, LogLevel, logger } from 'src/logger'
import { AlgodConfig, createNetworkConfig, isNetworkConfig, type NetworkConfig } from 'src/network'
import { StorageAdapter } from 'src/storage'
import {
  DEFAULT_STATE,
  isValidPersistedState,
  LOCAL_STORAGE_KEY,
  removeWallet,
  setActiveNetwork,
  setActiveWallet,
  type State,
  type ManagerStatus,
  type PersistedState
} from 'src/store'
import { createWalletMap } from 'src/utils'
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

export interface WalletManagerOptions {
  resetNetwork?: boolean
  debug?: boolean
  logLevel?: LogLevel
}

export interface WalletManagerConfig {
  wallets?: SupportedWallet[]
  networks?: Record<string, NetworkConfig>
  defaultNetwork?: string
  options?: WalletManagerOptions
}

export class WalletManager {
  public _clients: Map<WalletId, BaseWallet> = new Map()
  public networkConfig: Record<string, NetworkConfig>
  public store: Store<State>
  public subscribe: (callback: (state: State) => void) => () => void
  public options: { resetNetwork: boolean }

  private logger: ReturnType<typeof logger.createScopedLogger>

  constructor({
    wallets = [],
    networks,
    defaultNetwork = 'testnet',
    options = {}
  }: WalletManagerConfig = {}) {
    // Initialize scoped logger
    this.logger = this.initializeLogger(options)

    this.logger.debug('Initializing WalletManager with config:', {
      wallets,
      networks,
      defaultNetwork,
      options
    })

    // Initialize network config
    this.networkConfig = this.initNetworkConfig(networks)

    // Initialize options
    this.options = { resetNetwork: options.resetNetwork || false }

    // Load persisted state from local storage
    const persistedState = this.loadPersistedState()

    // Set active network
    const activeNetwork = this.options.resetNetwork
      ? defaultNetwork
      : persistedState?.activeNetwork || defaultNetwork

    // Validate active network exists in config
    if (!this.networkConfig[activeNetwork]) {
      throw new Error(`Network "${activeNetwork}" not found in network configuration`)
    }

    // Create Algod client for active network
    const algodClient = this.createAlgodClient(activeNetwork)

    // Create initial state
    const initialState: State = {
      ...DEFAULT_STATE,
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

  // ---------- Logging ----------------------------------------------- //

  private initializeLogger(
    options: WalletManagerOptions
  ): ReturnType<typeof logger.createScopedLogger> {
    const logLevel = this.determineLogLevel(options)
    Logger.setLevel(logLevel)
    return logger.createScopedLogger('WalletManager')
  }

  private determineLogLevel(options: WalletManagerOptions): LogLevel {
    if (options?.debug) {
      return LogLevel.DEBUG
    }
    return options?.logLevel !== undefined ? options.logLevel : LogLevel.WARN
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
      if (!isValidPersistedState(parsedState)) {
        this.logger.warn('Parsed state:', parsedState)
        throw new Error('Persisted state is invalid')
      }
      return parsedState
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

  // ---------- Status ------------------------------------------------ //

  public get status(): ManagerStatus {
    return this.store.state.managerStatus
  }

  public get isReady(): boolean {
    return this.store.state.managerStatus === 'ready'
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
        subscribe: this.subscribe,
        networks: this.networkConfig
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
    try {
      const promises = this.wallets.map((wallet) => wallet?.resumeSession())
      await Promise.all(promises)
    } finally {
      this.store.setState((state) => ({
        ...state,
        managerStatus: 'ready'
      }))
    }
  }

  public async disconnect(): Promise<void> {
    const promises = this.wallets
      .filter((wallet) => wallet.isConnected)
      .map((wallet) => wallet?.disconnect())

    await Promise.all(promises)
  }

  // ---------- Network ----------------------------------------------- //

  private initNetworkConfig(
    networks?: Record<string, NetworkConfig>
  ): Record<string, NetworkConfig> {
    this.logger.info('Initializing network configuration...')

    // Use provided networks or create default config with all official networks
    const config = networks || createNetworkConfig()

    // Validate network configurations
    for (const [id, network] of Object.entries(config)) {
      if (!isNetworkConfig(network)) {
        throw new Error(`Invalid network configuration for "${id}"`)
      }
    }

    this.logger.debug('Network configuration:', config)

    return config
  }

  private createAlgodClient(networkId: string): algosdk.Algodv2 {
    this.logger.info(`Creating Algodv2 client for ${networkId}...`)

    const network = this.networkConfig[networkId]
    if (!network) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    const { token = '', baseServer, port = '', headers = {} } = network.algod
    return new algosdk.Algodv2(token, baseServer, port, headers)
  }

  public getAlgodClient = (): algosdk.Algodv2 => {
    return this.algodClient
  }

  public setActiveNetwork = async (networkId: string): Promise<void> => {
    if (this.activeNetwork === networkId) {
      return
    }

    if (!this.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    const algodClient = this.createAlgodClient(networkId)
    setActiveNetwork(this.store, { networkId, algodClient })

    this.logger.info(`✅ Active network set to ${networkId}`)
  }

  public updateNetworkAlgod(networkId: string, algodConfig: Partial<AlgodConfig>): void {
    // Verify network exists
    if (!this.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    // Create new config merging existing with updates
    const updatedConfig = {
      ...this.networkConfig[networkId],
      algod: {
        ...this.networkConfig[networkId].algod,
        ...algodConfig
      }
    }

    // Validate the new configuration
    if (!isNetworkConfig(updatedConfig)) {
      throw new Error('Invalid network configuration')
    }

    // Update the network config
    this.networkConfig[networkId] = updatedConfig

    // If this is the active network, update the algod client
    if (this.activeNetwork === networkId) {
      this.algodClient = this.createAlgodClient(networkId)
    }

    this.logger.info(`✅ Updated algod configuration for ${networkId}`)
  }

  public get activeNetwork(): string {
    return this.store.state.activeNetwork
  }

  public get networks(): Record<string, NetworkConfig> {
    return { ...this.networkConfig }
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
