import { decodeEmptySignature, type EmptySignatureFields } from 'src/empty-signature'
import { logger } from 'src/logger'
import { NetworkConfig } from 'src/network'
import type { State } from 'src/store'
import algosdk from 'algosdk'
import { SignDataError } from 'src/wallets/types'
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

  /**
   * A `TransactionSigner` that returns placeholder-signed transactions without
   * prompting the wallet, for simulating with `allowEmptySignatures` (plus
   * `fixSigners` for rekeyed accounts). Each transaction carries its sender's
   * empty signature, or no signature if the sender's type is unknown, which
   * simulates as a single ed25519 key. The results can't be submitted.
   */
  public emptyTransactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const fieldsBySender = new Map<string, EmptySignatureFields>()

    return indexesToSign.map((index) => {
      const txn = txnGroup[index]
      const sender = txn.sender.toString()

      let fields = fieldsBySender.get(sender)
      if (!fields) {
        fields = this.getEmptySignatureFields(sender) ?? {}
        fieldsBySender.set(sender, fields)
      }

      return algosdk.encodeMsgpack(new algosdk.SignedTransaction({ ...fields, txn }))
    })
  }

  public canSignData = false

  public signData = async (
    _data: string,
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

  /**
   * Constructs an ARC-60 `StdSignData` object for the given data payload.
   * The signer public key is resolved via algod so that rekeyed accounts
   * sign with their auth address, and the authenticator data is the
   * SHA-256 hash of the current domain.
   */
  protected createStdSignData = async (data: string): Promise<StdSignData> => {
    const activeAddress = this.activeAddress
    if (!activeAddress) {
      this.logger.error('No active account')
      throw new SignDataError('No active account', 4100)
    }

    // ARC-60's `signer` is an ed25519 public key, so post-quantum accounts can't
    // sign data until the ARC supports other key types
    if (this.getEmptySignatureFields(activeAddress)?.pqsig) {
      this.logger.error('signData is not supported for post-quantum accounts')
      throw new SignDataError('signData is not supported for post-quantum accounts', 4200)
    }

    const domain = location.host
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(domain))
    const authenticatorData = new Uint8Array(digest)

    const algodClient = this.getAlgodClient()
    const acctInfo = await algodClient.accountInformation(activeAddress).do()
    const signer =
      acctInfo.authAddr?.publicKey ?? algosdk.Address.fromString(activeAddress).publicKey

    return { data, signer, domain, authenticatorData }
  }

  /**
   * Returns a connected account's decoded empty signature, or `undefined` if
   * the account type is unknown or its empty signature can't be decoded.
   */
  protected getEmptySignatureFields(address: string): EmptySignatureFields | undefined {
    const emptySignature = this.accounts.find((a) => a.address === address)?.emptySignature
    if (emptySignature === undefined) {
      return undefined
    }

    try {
      return decodeEmptySignature(emptySignature)
    } catch (error: any) {
      this.logger.warn(`Ignoring invalid empty signature for ${address}: ${error.message}`)
      return undefined
    }
  }

  protected onDisconnect = (): void => {
    this.logger.debug(`Removing wallet from store...`)
    this.store.removeWallet()
  }

  protected updateMetadata(updates: Partial<WalletMetadata>): void {
    this.metadata = { ...this.metadata, ...updates }
  }
}
