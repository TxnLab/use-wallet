import type algosdk from 'algosdk'
import type { State } from 'src/store'
import type { BaseWallet } from 'src/wallets/base'

// ---------- Wallet Identity ---------------------------------------- //

/**
 * Wallet identifier. In v5 this is an open string type — each adapter
 * package exports its own ID constant (e.g. `export const WALLET_ID = 'pera' as const`).
 */
export type WalletId = string

/**
 * Unique key for a wallet instance in the store.
 * Usually equals the wallet ID, but can be a composite key for
 * skinned WalletConnect instances (e.g. 'walletconnect:biatec').
 */
export type WalletKey = string

// ---------- Wallet Metadata & Account ------------------------------ //

export type WalletMetadata = {
  name: string
  icon: string
}

export type WalletAccount = {
  name: string
  address: string
  metadata?: Record<string, unknown>
}

// ---------- Wallet Capabilities ----------------------------------- //

/**
 * Declares which networks a wallet adapter supports.
 *
 * Design: Option 5 — `supportedNetworks` + `excludedNetworks`.
 *
 * Most wallets list the networks they work with via `supportedNetworks`.
 * Omitting both means "all networks". For wallets that work on all
 * networks *except* specific ones (e.g. Mnemonic excludes MainNet for
 * security), use `excludedNetworks`. Setting both is invalid.
 */
export interface WalletCapabilities {
  /** If set, the wallet is only available on these networks. */
  supportedNetworks?: string[]
  /** If set, the wallet is available on all networks EXCEPT these. */
  excludedNetworks?: string[]
}

// ---------- Adapter Interfaces ------------------------------------- //

/**
 * Scoped store accessor provided to each adapter instance.
 * All mutations are pre-bound to the adapter's wallet key —
 * adapters cannot accidentally modify another wallet's state.
 */
export interface AdapterStoreAccessor {
  getWalletState(): WalletState | undefined
  getActiveWallet(): WalletKey | null
  getActiveNetwork(): string
  getState(): State
  addWallet(wallet: WalletState): void
  removeWallet(): void
  setAccounts(accounts: WalletAccount[]): void
  setActiveAccount(address: string): void
  setActive(): void
}

/**
 * Constructor parameters for adapter classes.
 * Generic over the options type so adapters receive typed options
 * without unsafe casts.
 */
export interface AdapterConstructorParams<TOptions = Record<string, unknown>> {
  id: string
  metadata: WalletMetadata
  store: AdapterStoreAccessor
  subscribe: (callback: (state: State) => void) => () => void
  getAlgodClient: () => algosdk.Algodv2
  options?: TOptions
}

/**
 * Return type of adapter factory functions.
 * Uses `Record<string, unknown>` for options (type erasure) because
 * the manager handles heterogeneous adapter configs in a single array.
 * Type safety lives in the factory function signature, not here.
 */
export interface WalletAdapterConfig {
  /** Unique identifier for this wallet adapter */
  id: string
  /** Display metadata (name, icon) */
  metadata: WalletMetadata
  /** The adapter class constructor */
  Adapter: new (params: AdapterConstructorParams) => BaseWallet
  /** Wallet-specific options, passed through to the adapter constructor */
  options?: Record<string, unknown>
  /** Network capabilities — which networks this wallet supports */
  capabilities?: WalletCapabilities
}

/**
 * Common options accepted by all wallet adapter factory functions.
 * Adapter packages intersect this with their own options type:
 * `function myWallet(options?: MyWalletOptions & WalletFactoryOptions)`
 */
export interface WalletFactoryOptions {
  /** Override the wallet's default display metadata (name, icon) */
  metadata?: Partial<WalletMetadata>
}

// ---------- Wallet Interface (public-facing) ----------------------- //

/**
 * The public-facing wallet shape returned by framework hooks
 * (e.g. `useWallet()` in React). Defined in core so all framework
 * adapters share a single type.
 */
export interface Wallet {
  id: string
  walletKey: string
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

// ---------- Wallet State ------------------------------------------- //

export type WalletState = {
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
}

// ---------- Transaction Types -------------------------------------- //

/** @see https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0001.md#interface-multisigmetadata */
export interface MultisigMetadata {
  /**
   * Multisig version.
   */
  version: number

  /**
   * Multisig threshold value. Authorization requires a subset of signatures,
   * equal to or greater than the threshold value.
   */
  threshold: number

  /**
   * List of Algorand addresses of possible signers for this
   * multisig. Order is important.
   */
  addrs: string[]
}

/** @see https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0001.md#interface-wallettransaction */
export interface WalletTransaction {
  /**
   * Base64 encoding of the canonical msgpack encoding of a Transaction.
   */
  txn: string

  /**
   * Optional authorized address used to sign the transaction when the account
   * is rekeyed. Also called the signor/sgnr.
   */
  authAddr?: string

  /**
   * Multisig metadata used to sign the transaction
   */
  msig?: MultisigMetadata

  /**
   * Optional list of addresses that must sign the transactions
   */
  signers?: string[]

  /**
   * Optional base64 encoding of the canonical msgpack encoding of a
   * SignedTxn corresponding to txn, when signers=[]
   */
  stxn?: string

  /**
   * Optional message explaining the reason of the transaction
   */
  message?: string

  /**
   * Optional message explaining the reason of this group of transaction
   * Field only allowed in the first transaction of a group
   */
  groupMessage?: string
}

/** @see https://github.com/perawallet/connect/blob/1.3.4/src/util/model/peraWalletModels.ts */
export interface SignerTransaction {
  txn: algosdk.Transaction

  /**
   * Optional authorized address used to sign the transaction when
   * the account is rekeyed. Also called the signor/sgnr.
   */
  authAddr?: string

  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[]

  /**
   * Optional message explaining the reason of the transaction
   */
  message?: string
}

export interface JsonRpcRequest<T = any> {
  id: number
  jsonrpc: string
  method: string
  params: T
}

export class SignTxnsError extends Error {
  code: number
  data?: any

  constructor(message: string, code: number, data?: any) {
    super(message)
    this.name = 'SignTxnsError'
    this.code = code
    this.data = data
  }
}

// ---------- signData Types ----------------------------------------- //

export interface Siwa {
  domain: string
  account_address: string
  uri: string
  version: string
  statement?: string
  nonce?: string
  'issued-at'?: string
  'expiration-time'?: string
  'not-before'?: string
  'request-id'?: string
  chain_id: string
  resources?: string[]
  type: 'ed25519'
}

export class SignDataError extends Error {
  code: number
  data?: any

  constructor(message: string, code: number, data?: any) {
    super(message)
    this.name = 'SignDataError'
    this.code = code
    this.data = data
  }
}

export interface StdSignData {
  data: string
  signer: Uint8Array
  domain: string
  authenticatorData: Uint8Array
  requestId?: string
  hdPath?: string
}

export interface StdSignDataResponse extends StdSignData {
  signature: Uint8Array
}

export enum ScopeType {
  UNKNOWN = -1,
  AUTH = 1
}

export interface StdSignMetadata {
  scope: ScopeType
  encoding: string
}
