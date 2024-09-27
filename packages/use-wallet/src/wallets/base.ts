import { logger } from 'src/logger'
import { StorageAdapter } from 'src/storage'
import { setActiveWallet, setActiveAccount, removeWallet, type State } from 'src/store'
import type { Store } from '@tanstack/store'
import type algosdk from 'algosdk'
import type { NetworkId } from 'src/network'
import type { WalletAccount, WalletConstructor, WalletId, WalletMetadata } from 'src/wallets/types'

interface WalletConstructorType {
  new (...args: any[]): BaseWallet
  defaultMetadata: WalletMetadata
}

export abstract class BaseWallet {
  readonly id: WalletId
  readonly metadata: WalletMetadata

  protected store: Store<State>
  protected getAlgodClient: () => algosdk.Algodv2

  public subscribe: (callback: (state: State) => void) => () => void

  protected logger: ReturnType<typeof logger.createScopedLogger>

  protected constructor({
    id,
    metadata,
    store,
    subscribe,
    getAlgodClient
  }: WalletConstructor<WalletId>) {
    this.id = id
    this.store = store
    this.subscribe = subscribe
    this.getAlgodClient = getAlgodClient

    const ctor = this.constructor as WalletConstructorType
    this.metadata = { ...ctor.defaultMetadata, ...metadata }

    // Initialize logger with a scope based on the wallet ID
    this.logger = logger.createScopedLogger(`Wallet:${this.id.toUpperCase()}`)
  }

  static defaultMetadata: WalletMetadata = { name: 'Base Wallet', icon: '' }

  // ---------- Public Methods ---------------------------------------- //

  public abstract connect(args?: Record<string, any>): Promise<WalletAccount[]>
  public abstract disconnect(): Promise<void>
  public abstract resumeSession(): Promise<void>

  public setActive = (): void => {
    this.logger.info(`Set active wallet: ${this.id}`)
    setActiveWallet(this.store, { walletId: this.id })
  }

  public setActiveAccount = (account: string): void => {
    this.logger.info(`Set active account: ${account}`)
    setActiveAccount(this.store, {
      walletId: this.id,
      address: account
    })
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

  // ---------- Derived Properties ------------------------------------ //

  public get name(): string {
    return this.id.toUpperCase()
  }

  public get accounts(): WalletAccount[] {
    const state = this.store.state
    const walletState = state.wallets[this.id]
    return walletState ? walletState.accounts : []
  }

  public get addresses(): string[] {
    return this.accounts.map((account) => account.address)
  }

  public get activeAccount(): WalletAccount | null {
    const state = this.store.state
    const walletState = state.wallets[this.id]
    return walletState ? walletState.activeAccount : null
  }

  public get activeAddress(): string | null {
    return this.activeAccount?.address ?? null
  }

  public get activeNetwork(): NetworkId {
    const state = this.store.state
    return state.activeNetwork
  }

  public get isConnected(): boolean {
    const state = this.store.state
    const walletState = state.wallets[this.id]
    return walletState ? walletState.accounts.length > 0 : false
  }

  public get isActive(): boolean {
    const state = this.store.state
    return state.activeWallet === this.id
  }

  // ---------- Protected Methods ------------------------------------- //

  protected onDisconnect = (): void => {
    this.logger.debug(`Removing wallet from store...`)
    removeWallet(this.store, { walletId: this.id })
  }

  protected manageWalletConnectSession = (
    action: 'backup' | 'restore',
    targetWalletId?: WalletId
  ): void => {
    const walletId = targetWalletId || this.id
    if (action === 'backup') {
      const data = StorageAdapter.getItem('walletconnect')
      if (data) {
        StorageAdapter.setItem(`walletconnect-${walletId}`, data)
        StorageAdapter.removeItem('walletconnect')
        this.logger.debug(`Backed up WalletConnect session for ${walletId}`)
      }
    } else if (action === 'restore') {
      const data = StorageAdapter.getItem(`walletconnect-${walletId}`)
      if (data) {
        StorageAdapter.setItem('walletconnect', data)
        StorageAdapter.removeItem(`walletconnect-${walletId}`)
        this.logger.debug(`Restored WalletConnect session for ${walletId}`)
      }
    }
  }
}
