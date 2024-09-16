import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import { compareAccounts } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from 'src/wallets/types'

export type CustomProvider = {
  connect(args?: Record<string, any>): Promise<WalletAccount[]>
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
}

export interface CustomWalletOptions {
  provider: CustomProvider
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="#525252" />
</svg>
`)}`

export class CustomWallet extends BaseWallet {
  private provider: CustomProvider
  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.CUSTOM>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.provider) {
      this.logger.error('Missing required option: provider')
      throw new Error('Missing required option: provider')
    }
    this.provider = options.provider
    this.store = store
  }

  static defaultMetadata = {
    name: 'Custom',
    icon: ICON
  }

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

      addWallet(this.store, {
        walletId: this.id,
        wallet: walletState
      })

      this.logger.info('✅ Connected.', walletState)
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
      const state = this.store.state
      const walletState = state.wallets[this.id]

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
          setAccounts(this.store, {
            walletId: this.id,
            accounts: walletAccounts
          })
        }
      }
      this.logger.info('Session resumed.')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      throw error
    }
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!this.provider.signTransactions) {
      this.logger.error('Method not supported: signTransactions')
      throw new Error('Method not supported: signTransactions')
    }
    this.logger.debug('Signing transactions...')
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
    this.logger.debug('Transaction signer called...')
    return await this.provider.transactionSigner(txnGroup, indexesToSign)
  }
}
