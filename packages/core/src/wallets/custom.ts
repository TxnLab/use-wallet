import algosdk from 'algosdk'
import { BaseWallet } from './base'
import { compareAccounts } from '../utils'
import type {
  AdapterConstructorParams,
  StdSignDataResponse,
  StdSignMetadata,
  WalletAccount,
  WalletAdapterConfig,
  WalletFactoryOptions,
  WalletMetadata,
  WalletState
} from './types'

export type CustomProvider = {
  connect?(args?: Record<string, any>): Promise<WalletAccount[]>
  disconnect?(): Promise<void>
  resumeSession?(): Promise<WalletAccount[] | void>
  signTransactions?<T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]>
  transactionSigner?(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]>
  signData?(data: string, metadata: StdSignMetadata): Promise<StdSignDataResponse>
}

export interface CustomWalletOptions {
  provider: CustomProvider
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="#525252" />
</svg>
`)}`

const CUSTOM_WALLET_ID = 'custom' as const

export class CustomWallet extends BaseWallet<CustomWalletOptions> {
  private provider: CustomProvider

  constructor(params: AdapterConstructorParams<CustomWalletOptions>) {
    super(params)

    if (!params.options?.provider) {
      this.logger.error('Missing required option: provider')
      throw new Error('Missing required option: provider')
    }

    this.provider = params.options.provider

    // Set canSignData based on whether the provider supports it
    this.canSignData = typeof this.provider.signData === 'function'
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Custom',
    icon: ICON
  }

  // ---------- Public Methods ----------------------------------------- //

  public connect = async (args?: Record<string, any>): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    try {
      if (!this.provider.connect) {
        this.logger.error('Method not supported: connect')
        throw new Error('Method not supported: connect')
      }

      const walletAccounts = await this.provider.connect(args)

      if (walletAccounts.length === 0) {
        this.logger.error('No accounts found!')
        throw new Error('No accounts found!')
      }

      const activeAccount = walletAccounts[0]

      const walletState: WalletState = {
        accounts: walletAccounts,
        activeAccount
      }

      this.store.addWallet(walletState)

      this.logger.info('Connected successfully', walletState)
      return walletAccounts
    } catch (error: any) {
      this.logger.error('Error connecting:', error.message || error)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    this.onDisconnect()
    await this.provider.disconnect?.()
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const walletState = this.store.getWalletState()

      // No session to resume
      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      this.logger.info('Resuming session...')

      const result = await this.provider.resumeSession?.()

      if (Array.isArray(result)) {
        const walletAccounts = result

        if (walletAccounts.length === 0) {
          this.logger.error('No accounts found!')
          throw new Error('No accounts found!')
        }

        const match = compareAccounts(walletAccounts, walletState.accounts)

        if (!match) {
          this.logger.warn('Session accounts mismatch, updating accounts', {
            prev: walletState.accounts,
            current: walletAccounts
          })
          this.store.setAccounts(walletAccounts)
        }
      }
      this.logger.info('Session resumed successfully')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      throw error
    }
  }

  // ---------- Transaction Signing ------------------------------------ //

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!this.provider.signTransactions) {
      this.logger.error('Method not supported: signTransactions')
      throw new Error('Method not supported: signTransactions')
    }
    this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })
    return await this.provider.signTransactions(txnGroup, indexesToSign)
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!this.provider.transactionSigner) {
      this.logger.error('Method not supported: transactionSigner')
      throw new Error('Method not supported: transactionSigner')
    }
    this.logger.debug('Transaction signer called...', {
      txnGroup,
      indexesToSign
    })
    return await this.provider.transactionSigner(txnGroup, indexesToSign)
  }

  // ---------- Sign Data ---------------------------------------------- //

  /*
   * The developer must own the ARC-60 object construction.
   * See BaseWallet.createStdSignData for a helper function.
   */
  public signData = async (
    data: string,
    metadata: StdSignMetadata
  ): Promise<StdSignDataResponse> => {
    if (!this.provider.signData) {
      this.logger.error('Method not supported: signData')
      throw new Error('Method not supported: signData')
    }
    this.logger.debug('Signing data...', { data, metadata })
    return await this.provider.signData(data, metadata)
  }
}

// ---------- Factory Function ----------------------------------------- //

export function custom(options: CustomWalletOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options
  return {
    id: CUSTOM_WALLET_ID,
    metadata: { ...CustomWallet.defaultMetadata, ...metadata },
    Adapter: CustomWallet as unknown as WalletAdapterConfig['Adapter'],
    options: adapterOptions as unknown as Record<string, unknown>
  }
}
