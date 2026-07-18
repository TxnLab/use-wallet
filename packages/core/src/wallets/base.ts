import { logger } from 'src/logger'
import { NetworkConfig } from 'src/network'
import type { State } from 'src/store'
import type algosdk from 'algosdk'
import type {
  AdapterConstructorParams,
  AdapterStoreAccessor,
  StdSignData,
  StdSignDataResponse,
  StdSignMetadata,
  WalletAccount,
  WalletMetadata
} from 'src/wallets/types'

export abstract class BaseWallet<TOptions = Record<string, unknown>> {
  public readonly id: string
  public readonly walletKey: string
  public metadata: WalletMetadata

  protected options: TOptions
  protected store: AdapterStoreAccessor
  protected getAlgodClient: () => algosdk.Algodv2

  public subscribe: (callback: (state: State) => void) => () => void

  protected logger: ReturnType<typeof logger.createScopedLogger>

  protected constructor({
    id,
    metadata,
    store,
    subscribe,
    getAlgodClient,
    options
  }: AdapterConstructorParams<TOptions>) {
    this.id = id
    this.walletKey = id
    this.metadata = { ...metadata }
    this.options = options ?? ({} as TOptions)
    this.store = store
    this.subscribe = subscribe
    this.getAlgodClient = getAlgodClient

    // Initialize logger with a scope based on the wallet key
    this.logger = logger.createScopedLogger(`Wallet:${this.walletKey.toUpperCase()}`)
  }

  static defaultMetadata: WalletMetadata = { name: 'Base Wallet', icon: '' }

  // ---------- Public Methods ---------------------------------------- //

  public abstract connect(args?: Record<string, any>): Promise<WalletAccount[]>
  public abstract disconnect(): Promise<void>
  public abstract resumeSession(): Promise<void>

  public setActive = (): void => {
    this.logger.info(`Set active wallet: ${this.walletKey}`)
    this.store.setActive()
  }

  public setActiveAccount = (account: string): void => {
    this.logger.info(`Set active account: ${account}`)
    this.store.setActiveAccount(account)
  }

  public abstract signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]>

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const signTxnsResult = await this.signTransactions(txnGroup, indexesToSign)

    const signedTxns = signTxnsResult.reduce<Uint8Array[]>((acc, value) => {
      if (value !== null) {
        acc.push(value)
      }
      return acc
    }, [])

    return signedTxns
  }

  public canSignData = false

  public signData = async (
    _data: StdSignData,
    _metadata: StdSignMetadata
  ): Promise<StdSignDataResponse> => {
    this.logger.error('Method not supported: signData')
    throw new Error('Method not supported: signData')
  }

  public canUsePrivateKey = false

  public withPrivateKey = async <T>(
    _callback: (secretKey: Uint8Array) => Promise<T>
  ): Promise<T> => {
    this.logger.error('Method not supported: withPrivateKey')
    throw new Error('Method not supported: withPrivateKey')
  }

  // ---------- Derived Properties ------------------------------------ //

  public get name(): string {
    return this.id.toUpperCase()
  }

  public get accounts(): WalletAccount[] {
    const walletState = this.store.getWalletState()
    return walletState ? walletState.accounts : []
  }

  public get addresses(): string[] {
    return this.accounts.map((account) => account.address)
  }

  public get activeAccount(): WalletAccount | null {
    const walletState = this.store.getWalletState()
    return walletState ? walletState.activeAccount : null
  }

  public get activeAddress(): string | null {
    return this.activeAccount?.address ?? null
  }

  public get activeNetwork(): string {
    return this.store.getActiveNetwork()
  }

  public get isConnected(): boolean {
    const walletState = this.store.getWalletState()
    return walletState ? walletState.accounts.length > 0 : false
  }

  public get isActive(): boolean {
    return this.store.getActiveWallet() === this.walletKey
  }

  public get activeNetworkConfig(): NetworkConfig {
    const state = this.store.getState()
    return state.networkConfig[state.activeNetwork]
  }

  // ---------- Protected Methods ------------------------------------- //

  protected onDisconnect = (): void => {
    this.logger.debug(`Removing wallet from store...`)
    this.store.removeWallet()
  }

  protected updateMetadata(updates: Partial<WalletMetadata>): void {
    this.metadata = { ...this.metadata, ...updates }
  }
}
