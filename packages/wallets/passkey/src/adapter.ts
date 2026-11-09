/**
 * Passkey Wallet Adapter for Algorand
 *
 * Derives a Falcon-1024 (post-quantum) account from a passkey's WebAuthn PRF
 * output. There is no extension, app or seed phrase to set up; the passkey
 * provider (iCloud Keychain, Google Password Manager, 1Password, Windows
 * Hello, a security key) syncs and protects the credential.
 *
 * SECURITY MODEL: the account is app-scoped.
 * - It is bound to the relying party ID (by default the page's hostname). Any
 *   script running there can derive the key with one verified passkey prompt
 *   that looks like a sign-in: the dApp itself, an XSS bug, a compromised
 *   dependency, or whoever takes over the domain. Other sites can't derive it.
 * - The account is stranded if the domain is lost, so offer
 *   `exportRecoveryPhrase` and a way to move to a wallet. See the README.
 * - Only public data is persisted: the credential ID, public key, address
 *   salt and address, and the addresses of accounts rekeyed to it. Never the
 *   PRF output, the entropy or the private key.
 * - The private key lives in a dedicated worker, never on the main thread.
 *   Without `session`, the worker is terminated after every request.
 * - Accounts rekeyed to the passkey account (`addRekeyedAccount`) are signed
 *   for by the same key, so they share its trust boundary.
 */

import algosdk from 'algosdk'
import { canonify } from 'canonify'
import {
  BaseWallet,
  ScopeType,
  SignDataError,
  encodeEmptySignature,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type Siwa,
  type StdSignDataResponse,
  type StdSignMetadata,
  type WalletAccount,
  type WalletMetadata,
  type WalletState
} from '@txnlab/use-wallet/adapter'
import { assertValidContext, prfInput } from './derivation'
import { PasskeyError } from './errors'
import { icon } from './icon'
import { WorkerKeyStore, type PasskeyKeyStore, type WorkerKeyStoreLockReason } from './key-store'
import {
  canonicalAddress,
  loadRecord,
  removeRecord,
  saveRecord,
  type PasskeyRecord,
  type RekeyedAccount
} from './record'
import { assertUser, createPasskey, evaluatePrf, type PrfResult } from './webauthn'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000

/**
 * How to confirm a signing request while a session is unlocked:
 * - `silent`: sign without a prompt
 * - `presence`: a passkey prompt with `userVerification: 'preferred'`, which
 *   some providers satisfy with a tap and no biometric or system password
 * - `verify`: a passkey prompt with `userVerification: 'required'`
 *
 * These prompts evaluate no PRF, so they never change the account. When the
 * session is locked, the PRF ceremony that unlocks it is the confirmation.
 */
export type PasskeyConfirmation = 'silent' | 'presence' | 'verify'

export type PasskeySigningRequest =
  { type: 'transactions'; transactions: algosdk.Transaction[] } | { type: 'data'; siwa: Siwa }

/**
 * Why an unlocked session locked:
 * - `idle`, `max-age`: the built-in key store's timeouts
 * - `hidden`: the page was hidden, with `lockWhenHidden`
 * - `lock`: the app called `lock()`
 * - `disconnect`: the wallet disconnected
 * - `connect`: a new `connect` replaced or dropped the session
 * - `key-store`: the key store dropped the key itself, e.g. its worker failed
 */
export type PasskeyLockReason =
  WorkerKeyStoreLockReason | 'hidden' | 'lock' | 'disconnect' | 'connect'

export interface PasskeySessionOptions {
  /** Lock the session after this long without a signature; 0 never locks it. Default: 15 minutes */
  idleTimeoutMs?: number
  /** Lock the session this long after it unlocks, however active it is; 0 sets no limit. Default: 1 hour */
  maxAgeMs?: number
  /**
   * Lock the session when the page is hidden, e.g. the user switches tabs or
   * apps. A signing request in progress finishes first. Also applies to a
   * custom `keyStore`. Pass a function to follow a setting the user can
   * change; it's read each time the page is hidden. Default: `false`
   */
  lockWhenHidden?: boolean | (() => boolean)
}

export interface PasskeyOptions {
  /**
   * The WebAuthn relying party ID: the domain the passkey (and so the account)
   * is bound to. Default: `location.hostname`. Set a parent domain (e.g.
   * `example.com` for `app.example.com`) to share one account across its
   * subdomains.
   */
  rpId?: string
  /** The relying party name shown in passkey prompts. Default: the RP ID */
  rpName?: string
  /**
   * Separates this app's account from others on the same RP ID. Up to 128
   * characters, no `:`. Default: `''`. Changing it changes the account.
   */
  context?: string
  /** The user name new passkeys are saved under. Default: `<rpName> account` */
  userName?: string
  /**
   * Keep the key unlocked between signatures, so only the first signature
   * (or `connect`) runs a PRF ceremony with full user verification; later ones
   * are confirmed per `confirm`. The key is held in a dedicated worker until
   * the idle timeout, the maximum age, `disconnect` or a page reload. Default:
   * `false`, a PRF ceremony for every request.
   */
  session?: boolean | PasskeySessionOptions
  /**
   * Chooses how to confirm each signing request while a session is unlocked.
   * Called synchronously, before the prompt: WebKit drops the user gesture
   * across an await, so this must not be async. Default: `() => 'presence'`.
   */
  confirm?: (request: PasskeySigningRequest) => PasskeyConfirmation
  /**
   * Called when an unlocked session locks, so the app can show it (e.g. an
   * "Unlock" button) without polling `isUnlocked`. Not called without a
   * session, where the key is only held during a request.
   */
  onLock?: (reason: PasskeyLockReason) => void
  /**
   * Called when a locked session unlocks: on `connect`, `unlock`, or a
   * signature that ran the PRF ceremony. Not called without a session.
   */
  onUnlock?: () => void
  /**
   * Replaces the built-in worker key store, e.g. to keep a session across page
   * reloads. The adapter treats a custom key store as a session: it never
   * locks it after signing, only on `disconnect`. May be called more than once.
   */
  keyStore?: () => PasskeyKeyStore
}

export interface PasskeyConnectArgs {
  /** Create a new passkey (and account) instead of signing in with an existing one */
  create?: boolean
  /** The user name to save a new passkey under */
  userName?: string
}

export interface PasskeyRecoveryPhrase {
  /** Import the phrase as a Falcon-1024 account, not a regular 25-word account */
  scheme: 'falcon-1024'
  /** The 25-word phrase */
  phrase: string
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

/**
 * An account's empty signature. An account rekeyed to the passkey account
 * names it as the signer (`sgnr`), as its signed transactions do.
 */
function emptySignatureFor(record: PasskeyRecord, rekeyed = false): string {
  return encodeEmptySignature({
    pqsig: {
      sch: algosdk.FALCON_1024_SCHEME,
      slt: record.salt,
      pk: record.publicKey,
      sig: new Uint8Array()
    },
    ...(rekeyed && { sgnr: algosdk.Address.fromString(record.address) })
  })
}

/** A transaction's group ID, or `undefined` if it isn't in a group */
function groupIdOf(txn: algosdk.Transaction): string | undefined {
  const { group } = txn
  return group && group.some((byte) => byte !== 0) ? algosdk.bytesToBase64(group) : undefined
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)))
}

export class PasskeyAdapter extends BaseWallet<PasskeyOptions> {
  private keyStore: PasskeyKeyStore | null = null
  /** Signing requests in progress; hiding the page doesn't lock in the middle of one */
  private activeRequests = 0
  /** Whether the session was unlocked when `onLock`/`onUnlock` last checked */
  private reportedUnlocked = false
  /** The network the wallet's rekeyed accounts were last listed for */
  private listedNetwork: string

  constructor(params: AdapterConstructorParams<PasskeyOptions>) {
    super(params)
    assertValidContext(this.context)
    if (this.isSession && this.sessionOptions.lockWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange)
    }
    this.listedNetwork = this.networkKey
    this.subscribe(this.onStateChange)
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Passkey',
    icon: ICON
  }

  // ---------- Options ----------------------------------------------- //

  private get rpId(): string {
    return this.options.rpId ?? location.hostname
  }

  private get rpName(): string {
    return this.options.rpName ?? this.rpId
  }

  private get context(): string {
    return this.options.context ?? ''
  }

  /** True when the key stays unlocked between requests */
  private get isSession(): boolean {
    return !!this.options.session || !!this.options.keyStore
  }

  private get sessionOptions(): PasskeySessionOptions {
    const { session } = this.options
    return typeof session === 'object' ? session : {}
  }

  private get lockWhenHidden(): boolean {
    const { lockWhenHidden } = this.sessionOptions
    if (!this.isSession) return false
    if (typeof lockWhenHidden !== 'function') return !!lockWhenHidden
    try {
      return lockWhenHidden()
    } catch (error: any) {
      // Fail closed
      this.logger.error('Error in lockWhenHidden:', error.message)
      return true
    }
  }

  private createKeyStore(): PasskeyKeyStore {
    if (this.options.keyStore) return this.options.keyStore()

    const session = !!this.options.session
    const { idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS, maxAgeMs = DEFAULT_MAX_AGE_MS } =
      this.sessionOptions
    return new WorkerKeyStore({
      idleTimeoutMs: session ? idleTimeoutMs : 0,
      maxAgeMs: session ? maxAgeMs : 0,
      onLock: (reason) => {
        this.logger.info(`Session locked (${reason})`)
        this.reportSession(reason)
      }
    })
  }

  private getKeyStore(): PasskeyKeyStore {
    this.keyStore ??= this.createKeyStore()
    return this.keyStore
  }

  /** Drop the key after a request, unless a session keeps it */
  private release(): void {
    if (!this.isSession || this.isHidden()) this.keyStore?.lock()
  }

  /** True when the page is hidden and the session should lock for it */
  private isHidden(): boolean {
    return (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      this.lockWhenHidden
    )
  }

  private onVisibilityChange = (): void => {
    // A passkey prompt can hide the page; a request in progress locks when it ends
    if (this.activeRequests === 0 && this.isHidden()) {
      this.keyStore?.lock()
      this.reportSession('hidden')
    }
  }

  /** Finish a request: drop the key unless the session keeps it, and report the session state */
  private finishRequest(): void {
    this.activeRequests--
    this.release()
    // Any other lock during the request was reported where it happened
    this.reportSession(this.isHidden() ? 'hidden' : 'key-store')
  }

  /**
   * Call `onLock` or `onUnlock` once when the session changes state, with
   * `reason` for a lock. Checks the key store itself, so a change is reported
   * however it happened.
   */
  private reportSession(reason: PasskeyLockReason): void {
    const unlocked = this.isSession && this.isUnlocked
    if (unlocked === this.reportedUnlocked) return
    this.reportedUnlocked = unlocked
    try {
      if (unlocked) this.options.onUnlock?.()
      else this.options.onLock?.(reason)
    } catch (error: any) {
      this.logger.error(`Error in ${unlocked ? 'onUnlock' : 'onLock'}:`, error.message)
    }
  }

  // ---------- Connection -------------------------------------------- //

  /**
   * Sign in with an existing passkey, or create one with `{ create: true }`.
   * Show both choices: a missing passkey and a cancelled prompt raise the same
   * error, so the adapter can't tell which one happened.
   */
  public connect = async (args?: PasskeyConnectArgs): Promise<WalletAccount[]> => {
    const rpId = this.rpId
    const context = this.context
    const input = prfInput(context)
    this.logger.info(args?.create ? 'Creating passkey...' : 'Connecting...')

    let result: PrfResult | undefined
    try {
      // The first ceremony starts before any await (WebKit drops the user gesture)
      if (args?.create) {
        const credentialId = await createPasskey({
          rpId,
          rpName: this.rpName,
          userName: args.userName ?? this.options.userName ?? `${this.rpName} account`
        })
        // Scope to the new credential so the picker can't bind a sibling passkey
        result = await evaluatePrf({ rpId, prfInput: input, credentialId })
      } else {
        result = await evaluatePrf({ rpId, prfInput: input })
      }

      this.keyStore?.lock()
      const keyStore = this.getKeyStore()
      const publicKey = await keyStore.unlock(result.prf)
      this.release()

      const { address, salt } = algosdk.addressFromPQKey(algosdk.FALCON_1024_SCHEME, publicKey)
      // Accounts rekeyed to this passkey account stay with it when it signs in again
      const previous = loadRecord()
      const record: PasskeyRecord = {
        version: 1,
        rpId,
        context,
        credentialId: result.credentialId,
        publicKey,
        salt,
        address: address.toString(),
        rekeyedAccounts: previous?.address === address.toString() ? previous.rekeyedAccounts : []
      }
      saveRecord(record)

      const walletAccount = this.ownAccount(record)
      const accounts = [
        walletAccount,
        ...this.rekeyedAddresses(record).map((rekeyed) => this.rekeyedAccount(record, rekeyed))
      ]
      const walletState: WalletState = { accounts, activeAccount: walletAccount }
      this.store.addWallet(walletState)
      this.reportSession(this.isHidden() ? 'hidden' : 'connect')
      void this.verifyRekeyedAccounts(record)

      this.logger.info('Connected successfully', walletState)
      return accounts
    } catch (error: any) {
      result?.prf.fill(0)
      this.keyStore?.lock()
      this.reportSession('connect')
      this.logger.error('Error connecting:', error.message)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    this.keyStore?.lock()
    this.reportSession('disconnect')
    this.keyStore = null
    removeRecord()
    this.onDisconnect()
    this.logger.info('Disconnected')
  }

  /**
   * Restores the accounts without a ceremony; the key unlocks on the first
   * signature. The accounts are listed from the record: the passkey's own
   * account and its rekeyed accounts on the active network, so a store that
   * another tab changed is reconciled rather than disconnected. Rekeyed
   * accounts are checked against algod again in the background, without
   * holding up the resume: one algod reports another auth address for is
   * dropped, and one it can't be asked about is kept.
   */
  public resumeSession = async (): Promise<void> => {
    const walletState = this.store.getWalletState()
    if (!walletState) {
      this.logger.info('No session to resume')
      return
    }

    const record = loadRecord()
    if (!record || !this.matchesRecord(record, walletState)) {
      this.logger.info('No passkey record for this session, disconnecting...')
      await this.disconnect()
      return
    }

    this.syncAccounts(record)
    this.logger.info('Session resumed')
    void this.verifyRekeyedAccounts(record)
  }

  /**
   * True when the record is for this adapter's RP ID and context, and the
   * store holds its account. The store's other accounts don't have to match:
   * they're listed from the record, which another tab may have changed.
   */
  private matchesRecord(record: PasskeyRecord, walletState: WalletState): boolean {
    return (
      record.rpId === this.rpId &&
      record.context === this.context &&
      walletState.accounts.some((account) => account.address === record.address)
    )
  }

  private requireRecord(): PasskeyRecord {
    const walletState = this.store.getWalletState()
    const record = loadRecord()
    if (!walletState || !record || !this.matchesRecord(record, walletState)) {
      throw new PasskeyError('not-connected', 'No passkey account is connected.')
    }
    return record
  }

  /** The passkey's own account, named after the domain it belongs to */
  private ownAccount(record: PasskeyRecord): WalletAccount {
    return {
      name: `${this.metadata.name} · ${record.rpId}`,
      address: record.address,
      emptySignature: emptySignatureFor(record)
    }
  }

  /** An account rekeyed to the passkey account */
  private rekeyedAccount(record: PasskeyRecord, address: string): WalletAccount {
    return {
      name: `${this.metadata.name} · rekeyed`,
      address,
      emptySignature: emptySignatureFor(record, true)
    }
  }

  // ---------- Rekeyed accounts -------------------------------------- //

  /**
   * The passkey account's own address, the auth address of its rekeyed
   * accounts, or `null` when no passkey account is connected. It's the active
   * address unless the app made a rekeyed account active.
   */
  public get passkeyAddress(): string | null {
    const walletState = this.store.getWalletState()
    const record = loadRecord()
    return walletState && record && this.matchesRecord(record, walletState) ? record.address : null
  }

  /**
   * Adds an account that is rekeyed to the passkey account, so the adapter
   * signs for it with the passkey's key. Finding them is up to the app, e.g.
   * an indexer search for accounts whose `auth-addr` is `passkeyAddress`.
   *
   * Reads the account from algod first, and throws a `PasskeyError` with code
   * `not-rekeyed` if its auth address is anything else (dropping it if it was
   * added before), or `failed` if algod can't be read. The account is recorded
   * for the active network and kept across reloads, the active account
   * doesn't change, and adding an account again checks it again, restoring
   * an empty signature the manager cleared.
   */
  public addRekeyedAccount = async (address: string): Promise<WalletAccount> => {
    const { address: passkeyAddress } = this.requireRecord()
    const canonical = canonicalAddress(address)
    if (!canonical) {
      throw new PasskeyError('failed', `Not an Algorand address: ${address}`)
    }
    if (canonical === passkeyAddress) {
      throw new PasskeyError(
        'not-rekeyed',
        `${canonical} is the passkey account itself, not an account rekeyed to it.`
      )
    }

    // The network the algod answer is for, even if it changes meanwhile
    const network = this.networkKey
    let authAddr: string | undefined
    try {
      authAddr = await this.getAuthAddr(canonical)
    } catch (error: any) {
      this.logger.error(`Error reading account ${canonical}:`, error.message)
      throw new PasskeyError(
        'failed',
        `Could not read account ${canonical} from algod: ${error.message}`,
        { cause: error }
      )
    }

    // The wallet may have disconnected, or signed in with another passkey, meanwhile
    const record = this.requireRecord()
    if (authAddr !== record.address) {
      this.dropRekeyedAccounts(record.address, network, [canonical])
      throw new PasskeyError(
        'not-rekeyed',
        `Account ${canonical} is not rekeyed to the passkey account ${record.address}.`
      )
    }

    const isNew = !record.rekeyedAccounts.some(
      (entry) => entry.address === canonical && entry.network === network
    )
    const updated: PasskeyRecord = isNew
      ? { ...record, rekeyedAccounts: [...record.rekeyedAccounts, { address: canonical, network }] }
      : record
    if (isNew) {
      saveRecord(updated)
      this.logger.info(`Added rekeyed account ${canonical}`)
    }
    this.syncAccounts(updated)
    return (
      this.accounts.find((account) => account.address === canonical) ??
      this.rekeyedAccount(updated, canonical)
    )
  }

  /**
   * Stops listing and signing for a rekeyed account on the active network. It
   * doesn't change the account on chain: it stays rekeyed to the passkey
   * account, so the passkey's key still controls it, until it's rekeyed
   * elsewhere. If it was the active account, the passkey's own account
   * becomes active. Does nothing for an address that isn't one of its rekeyed
   * accounts.
   */
  public removeRekeyedAccount = (address: string): void => {
    const record = this.requireRecord()
    const canonical = canonicalAddress(address)
    if (canonical) this.dropRekeyedAccounts(record.address, this.networkKey, [canonical])
  }

  /** The account's auth address on the active network, or `undefined` if it isn't rekeyed */
  private async getAuthAddr(address: string): Promise<string | undefined> {
    const info = await this.getAlgodClient().accountInformation(address).exclude('all').do()
    return info.authAddr?.toString()
  }

  /**
   * Checks the record's rekeyed accounts on the active network against its
   * algod, and drops those it reports another auth address for. Accounts
   * recorded for other networks are left alone. Best effort, and never
   * throws: an account algod can't be asked about is kept.
   */
  private async verifyRekeyedAccounts(record: PasskeyRecord): Promise<void> {
    const network = this.networkKey
    const addresses = this.rekeyedAddresses(record, network)
    const rekeyedAway = await Promise.all(
      addresses.map(async (address) => {
        try {
          return (await this.getAuthAddr(address)) !== record.address
        } catch (error: any) {
          this.logger.warn(`Could not check rekeyed account ${address}: ${error.message}`)
          return false
        }
      })
    )
    const dropped = addresses.filter((_, index) => rekeyedAway[index])
    if (dropped.length === 0) return

    this.logger.warn(`Dropping accounts no longer rekeyed to the passkey: ${dropped.join(', ')}`)
    try {
      this.dropRekeyedAccounts(record.address, network, dropped)
    } catch (error: any) {
      this.logger.error('Error dropping rekeyed accounts:', error.message)
    }
  }

  /**
   * Drops rekeyed accounts recorded for `network` from the record, then lists
   * the wallet's accounts again, as long as the passkey account
   * `passkeyAddress` is still the one connected.
   */
  private dropRekeyedAccounts(passkeyAddress: string, network: string, addresses: string[]): void {
    const record = loadRecord()
    if (!record || record.address !== passkeyAddress) return
    const isDropped = (entry: RekeyedAccount) =>
      entry.network === network && addresses.includes(entry.address)

    const updated: PasskeyRecord = {
      ...record,
      rekeyedAccounts: record.rekeyedAccounts.filter((entry) => !isDropped(entry))
    }
    if (updated.rekeyedAccounts.length !== record.rekeyedAccounts.length) {
      saveRecord(updated)
    }
    const walletState = this.store.getWalletState()
    if (walletState && this.matchesRecord(updated, walletState)) this.syncAccounts(updated)
  }

  /**
   * Lists the wallet's accounts from the record: the passkey's own account
   * first, then its rekeyed accounts on the active network. Each rekeyed
   * account is rebuilt, so an empty signature the manager cleared comes back
   * (and the manager checks it again), and accounts the record lacks go. The
   * active account stays if it's still listed; otherwise the passkey's own
   * account becomes active, since it's listed first.
   */
  private syncAccounts(record: PasskeyRecord): void {
    const walletState = this.store.getWalletState()
    if (!walletState) return

    const accounts = [
      walletState.accounts.find((account) => account.address === record.address) ??
        this.ownAccount(record),
      ...this.rekeyedAddresses(record).map((address) => this.rekeyedAccount(record, address))
    ]
    const unchanged =
      accounts.length === walletState.accounts.length &&
      accounts.every((account, index) => {
        const current = walletState.accounts[index]
        return (
          current.address === account.address &&
          current.name === account.name &&
          current.emptySignature === account.emptySignature
        )
      })
    if (!unchanged) this.store.setAccounts(accounts)
  }

  /**
   * The active network, as rekeyed accounts are recorded: its genesis hash,
   * or its network ID when its config has none (e.g. LocalNet)
   */
  private get networkKey(): string {
    const { activeNetwork, networkConfig } = this.store.getState()
    return networkConfig?.[activeNetwork]?.genesisHash ?? activeNetwork
  }

  /** The addresses of the record's rekeyed accounts on a network, by default the active one */
  private rekeyedAddresses(record: PasskeyRecord, network = this.networkKey): string[] {
    return record.rekeyedAccounts
      .filter((entry) => entry.network === network)
      .map((entry) => entry.address)
  }

  /** Lists the network's rekeyed accounts when the active network changes */
  private onStateChange = (): void => {
    const network = this.networkKey
    if (network === this.listedNetwork) return
    this.listedNetwork = network
    // After the store update that switched networks has run its course
    queueMicrotask(() => {
      try {
        const walletState = this.store.getWalletState()
        const record = loadRecord()
        if (!walletState || !record || !this.matchesRecord(record, walletState)) return
        this.syncAccounts(record)
        void this.verifyRekeyedAccounts(record)
      } catch (error: any) {
        this.logger.error('Error listing rekeyed accounts for the network:', error.message)
      }
    })
  }

  // ---------- Session ----------------------------------------------- //

  /** True when the key is unlocked, so the next signature needs no PRF ceremony */
  public get isUnlocked(): boolean {
    return this.keyStore?.unlocked ?? false
  }

  /**
   * Unlocks the session ahead of the next signature with one PRF ceremony
   * (full user verification), e.g. from an "Unlock" button after a page
   * reload, so signing needs no ceremony. Call it directly from the click
   * handler: iOS drops the tap across an await. Does nothing if the session is
   * already unlocked, or without `session`, where every request runs its own
   * ceremony.
   */
  public unlock = async (): Promise<void> => {
    const record = this.requireRecord()
    if (!this.isSession || this.isUnlocked) return

    this.logger.info('Unlocking...')
    this.activeRequests++
    try {
      await this.unlockKey(record)
      this.logger.info('Unlocked')
    } catch (error: any) {
      this.logger.error('Error unlocking:', error.message)
      throw error
    } finally {
      this.finishRequest()
    }
  }

  /**
   * Drops the key. The account stays connected; the next signature (or
   * `unlock`) runs a PRF ceremony.
   */
  public lock = (): void => {
    this.keyStore?.lock()
    this.reportSession('lock')
  }

  // ---------- Authorization ----------------------------------------- //

  /**
   * Unlock the key with a PRF ceremony for the connected credential, and check
   * it derives the connected account. Starts its prompt before any await.
   */
  private async unlockKey(record: PasskeyRecord): Promise<void> {
    const keyStore = this.getKeyStore()
    const { prf } = await evaluatePrf({
      rpId: record.rpId,
      prfInput: prfInput(record.context),
      credentialId: record.credentialId
    })
    const publicKey = await keyStore.unlock(prf)
    if (!bytesEqual(publicKey, record.publicKey)) {
      keyStore.lock()
      throw new PasskeyError(
        'key-mismatch',
        'This passkey derived a different key than the connected account. Disconnect and connect again.'
      )
    }
  }

  /**
   * Make sure the key is unlocked and the user approved this request. When the
   * key is locked, the PRF ceremony that unlocks it is the approval. Starts its
   * prompt before any await.
   */
  private async authorize(request: PasskeySigningRequest, record: PasskeyRecord): Promise<void> {
    const keyStore = this.getKeyStore()
    if (!keyStore.unlocked) return this.unlockKey(record)

    const confirmation = this.options.confirm?.(request) ?? 'presence'
    if (confirmation === 'silent') return
    await assertUser({
      rpId: record.rpId,
      credentialId: record.credentialId,
      // Anything but an explicit 'presence' gets full verification
      userVerification: confirmation === 'presence' ? 'preferred' : 'required'
    })
  }

  // ---------- Signing ----------------------------------------------- //

  /**
   * Picks the unsigned transactions at the requested indexes whose sender the
   * passkey's key authorizes at that point in their group: the passkey
   * account, one of its rekeyed accounts on the active network, or an account
   * that an earlier transaction in the same group (same non-empty group ID)
   * rekeys to the passkey account. That's a migration's proof transaction,
   * signed before the rekey is on chain; it's only valid alongside a rekey the
   * account's own key signed. The group applies in order, so an earlier rekey
   * in it to any other address takes the sender out. A rekey outside the
   * transaction's group counts for nothing.
   */
  private selectTxns(
    txns: { txn: algosdk.Transaction; isSigned: boolean }[],
    indexesToSign: number[] | undefined,
    record: PasskeyRecord
  ): algosdk.Transaction[] {
    const rekeyed = this.rekeyedAddresses(record)
    // `${groupId}:${sender}` → whether the passkey authorizes the sender, after
    // an earlier transaction in that group rekeyed it
    const rekeyedInGroup = new Map<string, boolean>()

    const txnsToSign: algosdk.Transaction[] = []
    txns.forEach(({ txn, isSigned }, index) => {
      const sender = txn.sender.toString()
      const groupId = groupIdOf(txn)
      const key = groupId && `${groupId}:${sender}`
      const isAuthorized =
        (key ? rekeyedInGroup.get(key) : undefined) ??
        (sender === record.address || rekeyed.includes(sender))

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      if (isIndexMatch && !isSigned && isAuthorized) {
        txnsToSign.push(txn)
      }
      if (key && txn.rekeyTo) {
        rekeyedInGroup.set(key, txn.rekeyTo.toString() === record.address)
      }
    })
    return txnsToSign
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[] | undefined,
    record: PasskeyRecord
  ): algosdk.Transaction[] {
    return this.selectTxns(
      txnGroup.map((txn) => ({ txn, isSigned: false })),
      indexesToSign,
      record
    )
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign: number[] | undefined,
    record: PasskeyRecord
  ): algosdk.Transaction[] {
    // Signed transactions are decoded too: an earlier rekey counts when it's signed
    const txns = txnGroup.map((txnBuffer) => {
      const isSigned = isSignedTxn(algosdk.msgpackRawDecode(txnBuffer))
      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)
      return { txn, isSigned }
    })
    return this.selectTxns(txns, indexesToSign, record)
  }

  /**
   * Signs the transactions the passkey's key authorizes: those sent from the
   * passkey account or one of its rekeyed accounts, and those sent from an
   * account that an earlier transaction in the same group rekeys to the
   * passkey account. Others are skipped. A transaction whose sender isn't the passkey
   * account carries the passkey account's address as `sgnr`.
   *
   * Each one carries a Falcon-1024 `pqsig` (about 3.2 KB) and pays an extra 2×
   * the minimum fee, whichever account sends it; get fees by simulating with
   * `emptyTransactionSigner`.
   */
  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    const record = this.requireRecord()

    const txnsToSign = isTransactionArray(txnGroup)
      ? this.processTxns(flattenTxnGroup(txnGroup), indexesToSign, record)
      : this.processEncodedTxns(flattenTxnGroup(txnGroup as Uint8Array[]), indexesToSign, record)
    if (txnsToSign.length === 0) return []

    this.activeRequests++
    try {
      this.logger.debug('Signing transactions...', { txnsToSign })
      await this.authorize({ type: 'transactions', transactions: txnsToSign }, record)

      const keyStore = this.getKeyStore()
      // Sets `sgnr` on each transaction whose sender isn't the key's own address
      const { txnSigner } = algosdk.addressWithSignersFromRawFalcon1024Signer({
        falcon1024PublicKey: record.publicKey,
        falcon1024Signer: (bytes) => keyStore.sign(bytes)
      })
      const signedTxns = await txnSigner(
        txnsToSign,
        txnsToSign.map((_, index) => index)
      )
      this.logger.debug('Transactions signed successfully')
      return signedTxns
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    } finally {
      this.finishRequest()
    }
  }

  // ---------- signData (ARC-60) ------------------------------------- //

  public canSignData = true

  /**
   * Signs an ARC-60 authentication request (SIWA) for the passkey account or
   * one of its rekeyed accounts with the passkey's Falcon key, scheme
   * `falcon-1024-det`. The signer is always the passkey's public key, and a
   * verifier checks it against the account's auth address. The signature
   * covers `SHA-256(data) || SHA-256(authenticatorData)`.
   */
  public signData = async (
    data: string,
    metadata: StdSignMetadata
  ): Promise<StdSignDataResponse> => {
    const record = this.requireRecord()

    // Validate before prompting, without awaiting
    if (metadata.encoding !== 'base64') {
      throw new SignDataError('Failed decoding', 4602)
    }
    if (metadata.scope !== ScopeType.AUTH) {
      throw new SignDataError('Invalid Scope', 4600)
    }
    // Sign exactly the bytes the dApp sent: strict UTF-8 with no BOM, so the
    // decoded JSON can't differ from them
    let bytes: Uint8Array
    let json: string
    let siwa: Siwa
    try {
      bytes = algosdk.base64ToBytes(data)
      json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      siwa = JSON.parse(json)
    } catch {
      throw new SignDataError('Bad JSON', 4609)
    }
    if (!siwa || typeof siwa !== 'object' || canonify(siwa) !== json) {
      throw new SignDataError('Bad JSON', 4609)
    }
    if (siwa.domain !== location.host) {
      throw new SignDataError('Failed Domain Auth', 4610)
    }
    const accountAddress = canonicalAddress(siwa.account_address)
    const isPasskeyAccount =
      accountAddress !== undefined &&
      (accountAddress === record.address || this.rekeyedAddresses(record).includes(accountAddress))
    if (siwa.type !== 'falcon-1024-det' || !isPasskeyAccount) {
      throw new SignDataError('Invalid Signer', 4603)
    }

    this.activeRequests++
    try {
      await this.authorize({ type: 'data', siwa }, record)

      // Checks on algod that the key still authorizes the requested account
      const stdSignData = await this.createStdSignData(data, accountAddress)
      if (!bytesEqual(stdSignData.signer, record.publicKey)) {
        throw new SignDataError('Invalid Signer', 4603)
      }

      const toSign = new Uint8Array([
        ...(await sha256(bytes)),
        ...(await sha256(stdSignData.authenticatorData))
      ])
      const signature = await this.getKeyStore().sign(toSign)
      return { ...stdSignData, signature }
    } catch (error: any) {
      this.logger.error('Error signing data:', error.message)
      throw error
    } finally {
      this.finishRequest()
    }
  }

  // ---------- Recovery ---------------------------------------------- //

  /**
   * Returns the account's 25-word recovery phrase after a fresh passkey
   * ceremony with full user verification. Show it with a warning that it must
   * be imported as a Falcon / quantum account (Lute: "Falcon25 account";
   * Pera: quantum import; `algokey pq import --scheme falcon-1024`): the same
   * words in a regular 25-word import restore a different, empty account.
   * The key also controls every account rekeyed to the passkey account.
   */
  public exportRecoveryPhrase = async (): Promise<PasskeyRecoveryPhrase> => {
    const record = this.requireRecord()

    const { prf } = await evaluatePrf({
      rpId: record.rpId,
      prfInput: prfInput(record.context),
      credentialId: record.credentialId
    })

    const check = this.createKeyStore()
    try {
      const publicKey = await check.unlock(new Uint8Array(prf))
      if (!bytesEqual(publicKey, record.publicKey)) {
        throw new PasskeyError(
          'key-mismatch',
          'This passkey derived a different key than the connected account.'
        )
      }
      return { scheme: 'falcon-1024', phrase: algosdk.mnemonicFromSeed(prf) }
    } finally {
      check.lock()
      prf.fill(0)
    }
  }
}
