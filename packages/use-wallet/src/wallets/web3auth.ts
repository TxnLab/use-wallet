/**
 * Web3Auth Wallet Provider for Algorand
 *
 * SECURITY CONSIDERATIONS:
 * - Web3Auth exposes the raw private key for non-EVM chains like Algorand
 * - This implementation uses SecureKeyContainer to minimize key exposure
 * - Keys are never persisted to localStorage or any storage
 * - Keys are cleared from memory immediately after signing operations
 * - Session resumption requires re-authentication (keys are not cached)
 *
 * @see https://web3auth.io/docs
 */

import algosdk from 'algosdk'
import { SecureKeyContainer, zeroMemory, deriveAlgorandAccountFromEd25519 } from 'src/secure-key'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import { flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from 'src/wallets/types'

// Type definitions for Web3Auth (to avoid requiring the package at compile time)
// These are minimal type definitions that match the actual Web3Auth API
interface IWeb3AuthProvider {
  request<T>(args: { method: string; params?: unknown }): Promise<T>
}

interface IWeb3AuthUserInfo {
  email?: string
  name?: string
  profileImage?: string
  verifier?: string
  verifierId?: string
  typeOfLogin?: string
  aggregateVerifier?: string
}

interface IWeb3AuthModal {
  initModal(): Promise<void>
  connect(): Promise<IWeb3AuthProvider | null>
  logout(): Promise<void>
  connected: boolean
  provider: IWeb3AuthProvider | null
  getUserInfo(): Promise<Partial<IWeb3AuthUserInfo>>
}

// Single Factor Auth SDK interface (for custom JWT auth)
interface IWeb3AuthSFA {
  init(): Promise<void>
  connect(params: {
    verifier: string
    verifierId: string
    idToken: string
  }): Promise<IWeb3AuthProvider | null>
  logout(): Promise<void>
  connected: boolean
  provider: IWeb3AuthProvider | null
}

/**
 * Parameters for custom authentication (e.g., Firebase, custom JWT)
 */
export interface Web3AuthCustomAuth {
  /**
   * Custom verifier name configured in Web3Auth dashboard
   */
  verifier: string

  /**
   * User identifier (e.g., email, Firebase UID)
   */
  verifierId: string

  /**
   * JWT token from your authentication provider (e.g., Firebase ID token)
   */
  idToken: string
}

/**
 * Web3Auth configuration options
 */
export interface Web3AuthOptions {
  /**
   * Web3Auth Client ID from the dashboard
   * @see https://dashboard.web3auth.io
   */
  clientId: string

  /**
   * Web3Auth network (mainnet, testnet, sapphire_mainnet, sapphire_devnet, cyan, aqua)
   * @default 'sapphire_mainnet'
   */
  web3AuthNetwork?: 'mainnet' | 'testnet' | 'sapphire_mainnet' | 'sapphire_devnet' | 'cyan' | 'aqua'

  /**
   * Login provider to use (google, facebook, twitter, discord, etc.)
   * If not specified, the Web3Auth modal will be shown
   */
  loginProvider?:
    | 'google'
    | 'facebook'
    | 'twitter'
    | 'discord'
    | 'reddit'
    | 'twitch'
    | 'apple'
    | 'line'
    | 'github'
    | 'kakao'
    | 'linkedin'
    | 'weibo'
    | 'wechat'
    | 'email_passwordless'
    | 'sms_passwordless'

  /**
   * Login hint for email_passwordless or sms_passwordless
   */
  loginHint?: string

  /**
   * UI configuration for the Web3Auth modal
   */
  uiConfig?: {
    appName?: string
    appUrl?: string
    logoLight?: string
    logoDark?: string
    defaultLanguage?: string
    mode?: 'light' | 'dark' | 'auto'
    theme?: Record<string, string>
  }

  /**
   * Whether to use the popup flow instead of redirect
   * @default true
   */
  usePopup?: boolean

  /**
   * Default verifier name for custom authentication.
   * When set, connect() can be called with just { idToken, verifierId }
   */
  verifier?: string
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#0364FF" width="40" height="40" rx="8"/>
  <path fill="#FFFFFF" d="M20 8c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S14.698 10.4 20 10.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zm0-16.8c-3.976 0-7.2 3.224-7.2 7.2s3.224 7.2 7.2 7.2 7.2-3.224 7.2-7.2-3.224-7.2-7.2-7.2zm0 12c-2.651 0-4.8-2.149-4.8-4.8s2.149-4.8 4.8-4.8 4.8 2.149 4.8 4.8-2.149 4.8-4.8 4.8z"/>
</svg>
`)}`

export class Web3AuthWallet extends BaseWallet {
  private web3auth: IWeb3AuthModal | null = null
  private web3authSFA: IWeb3AuthSFA | null = null
  private options: Web3AuthOptions
  private userInfo: Partial<IWeb3AuthUserInfo> | null = null

  /**
   * SECURITY: We store only the address, NEVER the private key.
   * Keys are fetched fresh from Web3Auth and immediately cleared after use.
   */
  private _address: string | null = null

  /** Track which SDK is currently in use */
  private usingSFA: boolean = false

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.WEB3AUTH>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    if (!options?.clientId) {
      this.logger.error('Missing required option: clientId')
      throw new Error('Missing required option: clientId')
    }

    this.options = {
      web3AuthNetwork: 'sapphire_mainnet',
      usePopup: true,
      ...options
    }
    this.store = store
  }

  static defaultMetadata = {
    name: 'Web3Auth',
    icon: ICON
  }

  /**
   * Initialize the Web3Auth client
   */
  private async initializeClient(): Promise<IWeb3AuthModal> {
    this.logger.info('Initializing Web3Auth client...')

    // Dynamic import to avoid bundling Web3Auth for users who don't need it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Web3Auth: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CHAIN_NAMESPACES: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let WEB3AUTH_NETWORK: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CommonPrivateKeyProvider: any

    try {
      // Dynamic imports - these are optional peer dependencies
      const modal = await import('@web3auth/modal')
      Web3Auth = modal.Web3Auth
      const base = await import('@web3auth/base')
      CHAIN_NAMESPACES = base.CHAIN_NAMESPACES
      WEB3AUTH_NETWORK = base.WEB3AUTH_NETWORK
      const baseProvider = await import('@web3auth/base-provider')
      CommonPrivateKeyProvider = baseProvider.CommonPrivateKeyProvider
    } catch {
      this.logger.error(
        'Failed to load Web3Auth. Make sure @web3auth/modal, @web3auth/base, and @web3auth/base-provider are installed.'
      )
      throw new Error(
        'Web3Auth packages not found. Please install @web3auth/modal, @web3auth/base, and @web3auth/base-provider'
      )
    }

    const chainConfig = {
      chainNamespace: CHAIN_NAMESPACES.OTHER,
      chainId: 'algorand',
      rpcTarget: 'https://mainnet-api.algonode.cloud', // Required by Web3Auth, not actually used for signing
      displayName: 'Algorand',
      blockExplorerUrl: 'https://lora.algokit.io/mainnet',
      ticker: 'ALGO',
      tickerName: 'Algorand'
    }

    const networkMap: Record<string, string> = {
      mainnet: WEB3AUTH_NETWORK.MAINNET,
      testnet: WEB3AUTH_NETWORK.TESTNET,
      sapphire_mainnet: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
      sapphire_devnet: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      cyan: WEB3AUTH_NETWORK.CYAN,
      aqua: WEB3AUTH_NETWORK.AQUA
    }

    // Create private key provider for non-EVM chains (required in Web3Auth v9)
    const privateKeyProvider = new CommonPrivateKeyProvider({
      config: { chainConfig }
    })

    const web3auth = new Web3Auth({
      clientId: this.options.clientId,
      web3AuthNetwork: networkMap[this.options.web3AuthNetwork || 'sapphire_mainnet'] as any,
      privateKeyProvider,
      uiConfig: this.options.uiConfig
    })

    await web3auth.initModal()
    this.web3auth = web3auth
    this.logger.info('Web3Auth client initialized')

    return web3auth
  }

  /**
   * Initialize the Web3Auth Single Factor Auth client for custom JWT authentication
   */
  private async initializeSFAClient(): Promise<IWeb3AuthSFA> {
    this.logger.info('Initializing Web3Auth Single Factor Auth client...')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Web3Auth: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let WEB3AUTH_NETWORK: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CommonPrivateKeyProvider: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CHAIN_NAMESPACES: any

    try {
      // Dynamic imports - these are optional peer dependencies
      const sfa = await import('@web3auth/single-factor-auth')
      Web3Auth = sfa.Web3Auth
      const base = await import('@web3auth/base')
      WEB3AUTH_NETWORK = base.WEB3AUTH_NETWORK
      CHAIN_NAMESPACES = base.CHAIN_NAMESPACES
      const baseProvider = await import('@web3auth/base-provider')
      CommonPrivateKeyProvider = baseProvider.CommonPrivateKeyProvider
    } catch {
      this.logger.error(
        'Failed to load Web3Auth SFA. Make sure @web3auth/single-factor-auth, @web3auth/base, and @web3auth/base-provider are installed.'
      )
      throw new Error(
        'Web3Auth SFA packages not found. Please install @web3auth/single-factor-auth, @web3auth/base, and @web3auth/base-provider'
      )
    }

    const chainConfig = {
      chainNamespace: CHAIN_NAMESPACES.OTHER,
      chainId: 'algorand',
      rpcTarget: 'https://mainnet-api.algonode.cloud', // Required by Web3Auth, not actually used for signing
      displayName: 'Algorand',
      blockExplorerUrl: 'https://lora.algokit.io/mainnet',
      ticker: 'ALGO',
      tickerName: 'Algorand'
    }

    const networkMap: Record<string, string> = {
      mainnet: WEB3AUTH_NETWORK.MAINNET,
      testnet: WEB3AUTH_NETWORK.TESTNET,
      sapphire_mainnet: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
      sapphire_devnet: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      cyan: WEB3AUTH_NETWORK.CYAN,
      aqua: WEB3AUTH_NETWORK.AQUA
    }

    // Create private key provider for non-EVM chains
    const privateKeyProvider = new CommonPrivateKeyProvider({
      config: { chainConfig }
    })

    const web3authSFA = new Web3Auth({
      clientId: this.options.clientId,
      web3AuthNetwork: networkMap[this.options.web3AuthNetwork || 'sapphire_mainnet'] as any,
      privateKeyProvider
    })

    await web3authSFA.init()
    this.web3authSFA = web3authSFA
    this.logger.info('Web3Auth SFA client initialized')

    return web3authSFA
  }

  /**
   * SECURITY: Fetch the private key from Web3Auth and return it in a SecureKeyContainer.
   * The caller MUST call container.clear() when done.
   *
   * @returns SecureKeyContainer holding the private key
   */
  private async getSecureKey(): Promise<SecureKeyContainer> {
    // Get the provider from either the modal SDK or SFA SDK
    const provider = this.usingSFA ? this.web3authSFA?.provider : this.web3auth?.provider

    if (!provider) {
      throw new Error('Web3Auth not connected')
    }

    this.logger.debug('Fetching private key from Web3Auth...')

    // Request the private key from Web3Auth
    // For non-EVM chains, Web3Auth returns the raw ed25519 private key
    const privateKeyHex = await provider.request<string>({
      method: 'private_key'
    })

    if (!privateKeyHex || typeof privateKeyHex !== 'string') {
      throw new Error('Failed to retrieve private key from Web3Auth')
    }

    // Convert hex string to Uint8Array
    const privateKeyBytes = this.hexToBytes(privateKeyHex)

    // SECURITY: Immediately clear the hex string from our scope
    // (The original string may still exist in Web3Auth's scope)

    // Wrap in SecureKeyContainer for safe handling
    const container = new SecureKeyContainer(privateKeyBytes)

    // SECURITY: Zero the local copy now that it's in the container
    zeroMemory(privateKeyBytes)

    this.logger.debug('Private key retrieved and secured')
    return container
  }

  /**
   * Convert a hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
    const bytes = new Uint8Array(cleanHex.length / 2)
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16)
    }
    return bytes
  }

  /**
   * Connect to Web3Auth
   *
   * @param args - Optional connection arguments
   * @param args.idToken - JWT token for custom authentication (e.g., Firebase ID token)
   * @param args.verifierId - User identifier for custom authentication (e.g., email, uid)
   * @param args.verifier - Custom verifier name (uses options.verifier if not provided)
   *
   * @example
   * // Standard modal connection
   * await wallet.connect()
   *
   * @example
   * // Custom authentication with Firebase
   * await wallet.connect({
   *   idToken: firebaseIdToken,
   *   verifierId: user.email,
   *   verifier: 'my-firebase-verifier'
   * })
   */
  public connect = async (args?: {
    idToken?: string
    verifierId?: string
    verifier?: string
  }): Promise<WalletAccount[]> => {
    this.logger.info('Connecting to Web3Auth...')

    try {
      let provider: IWeb3AuthProvider | null

      // Check if custom authentication params are provided
      const idToken = args?.idToken
      const verifierId = args?.verifierId
      const verifier = args?.verifier || this.options.verifier

      if (idToken && verifierId) {
        // Custom authentication flow using Single Factor Auth (e.g., Firebase)
        if (!verifier) {
          throw new Error(
            'Custom authentication requires a verifier. Provide it in connect() args or options.verifier'
          )
        }

        this.logger.info('Connecting with custom authentication (SFA)...', { verifier, verifierId })

        // Initialize the SFA client
        const web3authSFA = this.web3authSFA || (await this.initializeSFAClient())

        // Connect using Single Factor Auth - no modal, direct connection
        provider = await web3authSFA.connect({
          verifier,
          verifierId,
          idToken
        })

        this.usingSFA = true

        // SFA doesn't provide getUserInfo, use verifierId as display name
        this.userInfo = { email: verifierId }
      } else {
        // Standard modal connection
        const web3auth = this.web3auth || (await this.initializeClient())
        provider = await web3auth.connect()

        this.usingSFA = false

        // Get user info for display purposes (modal SDK only)
        this.userInfo = await web3auth.getUserInfo()
        this.logger.debug('User info retrieved', { email: this.userInfo.email })
      }

      if (!provider) {
        throw new Error('Failed to connect to Web3Auth')
      }

      // SECURITY: Get the key, derive the address, and immediately clear the key
      const keyContainer = await this.getSecureKey()

      try {
        const address = await keyContainer.useKey(async (secretKey) => {
          const account = await deriveAlgorandAccountFromEd25519(secretKey)
          // SECURITY: Zero the derived account's secret key immediately
          const addr = account.addr
          zeroMemory(account.sk)
          return addr
        })

        this._address = address
      } finally {
        // SECURITY: Always clear the key container
        keyContainer.clear()
      }

      const walletAccount: WalletAccount = {
        name: this.userInfo.name || this.userInfo.email || `${this.metadata.name} Account`,
        address: this._address
      }

      const walletState: WalletState = {
        accounts: [walletAccount],
        activeAccount: walletAccount
      }

      addWallet(this.store, {
        walletId: this.id,
        wallet: walletState
      })

      this.logger.info('Connected successfully', { address: this._address })
      return [walletAccount]
    } catch (error: any) {
      this.logger.error('Error connecting to Web3Auth:', error.message)
      throw error
    }
  }

  /**
   * Disconnect from Web3Auth
   */
  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting from Web3Auth...')

    try {
      if (this.usingSFA && this.web3authSFA?.connected) {
        await this.web3authSFA.logout()
      } else if (this.web3auth?.connected) {
        await this.web3auth.logout()
      }
    } catch (error: any) {
      this.logger.warn('Error during Web3Auth logout:', error.message)
    }

    // Clear local state
    this._address = null
    this.userInfo = null
    this.usingSFA = false
    this.onDisconnect()

    this.logger.info('Disconnected')
  }

  /**
   * Resume session from Web3Auth
   *
   * SECURITY: We do NOT cache the private key. On resume, we only verify
   * the session is still valid and the address matches. The key is only
   * fetched when actually needed for signing.
   */
  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      this.logger.info('Resuming Web3Auth session...')

      const web3auth = this.web3auth || (await this.initializeClient())

      if (!web3auth.connected || !web3auth.provider) {
        this.logger.warn('Web3Auth session expired, please reconnect')
        this.onDisconnect()
        return
      }

      // Get user info
      this.userInfo = await web3auth.getUserInfo()

      // SECURITY: Verify the address matches without caching the key
      const keyContainer = await this.getSecureKey()

      try {
        const currentAddress = await keyContainer.useKey(async (secretKey) => {
          const account = await deriveAlgorandAccountFromEd25519(secretKey)
          const addr = account.addr
          zeroMemory(account.sk)
          return addr
        })

        this._address = currentAddress

        const storedAccount = walletState.accounts[0]
        if (storedAccount.address !== currentAddress) {
          this.logger.warn('Session address mismatch, updating', {
            stored: storedAccount.address,
            current: currentAddress
          })

          const walletAccount: WalletAccount = {
            name: this.userInfo.name || this.userInfo.email || `${this.metadata.name} Account`,
            address: currentAddress
          }

          setAccounts(this.store, {
            walletId: this.id,
            accounts: [walletAccount]
          })
        }
      } finally {
        keyContainer.clear()
      }

      this.logger.info('Session resumed successfully')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      this.onDisconnect()
      throw error
    }
  }

  /**
   * Process transactions for signing
   */
  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = signer === this._address

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  /**
   * Process encoded transactions for signing
   */
  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

    txnGroup.forEach((txnBuffer, index) => {
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = !isSigned && signer === this._address

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  /**
   * Sign transactions
   *
   * SECURITY: The private key is fetched fresh, used for signing,
   * and immediately cleared from memory. The key is never stored
   * between signing operations.
   */
  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    try {
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })

      let txnsToSign: algosdk.Transaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      if (txnsToSign.length === 0) {
        this.logger.debug('No transactions to sign')
        return []
      }

      // SECURITY: Fetch key, sign, and immediately clear
      const keyContainer = await this.getSecureKey()
      let signedTxns: Uint8Array[] = []

      try {
        signedTxns = await keyContainer.useKey(async (secretKey) => {
          const account = await deriveAlgorandAccountFromEd25519(secretKey)

          try {
            // Sign all transactions
            const signed = txnsToSign.map((txn) => txn.signTxn(account.sk))
            return signed
          } finally {
            // SECURITY: Always zero the account's secret key
            zeroMemory(account.sk)
          }
        })
      } finally {
        // SECURITY: Always clear the key container
        keyContainer.clear()
      }

      this.logger.debug('Transactions signed successfully', { count: signedTxns.length })
      return signedTxns
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
