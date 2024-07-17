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
      throw new Error(`[${this.metadata.name}] Missing required option: provider`)
    }
    this.provider = options.provider
    this.store = store
  }

  static defaultMetadata = {
    name: 'Custom',
    icon: ICON
  }

  public connect = async (args?: Record<string, any>): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    try {
      if (!this.provider.connect) {
        throw new Error(`[${this.metadata.name}] Method not supported: connect`)
      }

      const walletAccounts = await this.provider.connect(args)

      if (walletAccounts.length === 0) {
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

      console.info(`[${this.metadata.name}] ✅ Connected.`, walletState)
      return walletAccounts
    } catch (error: any) {
      console.error(`[${this.metadata.name}] Error connecting:`, error.message || error)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    console.info(`[${this.metadata.name}] Disconnecting...`)
    this.onDisconnect()
    await this.provider.disconnect?.()
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      // No session to resume
      if (!walletState) {
        return
      }

      console.info(`[${this.metadata.name}] Resuming session...`)

      const result = await this.provider.resumeSession?.()

      if (Array.isArray(result)) {
        const walletAccounts = result

        if (walletAccounts.length === 0) {
          throw new Error(`[${this.metadata.name}] No accounts found!`)
        }

        const match = compareAccounts(walletAccounts, walletState.accounts)

        if (!match) {
          console.warn(`[${this.metadata.name}] Session accounts mismatch, updating accounts`, {
            prev: walletState.accounts,
            current: walletAccounts
          })
          setAccounts(this.store, {
            walletId: this.id,
            accounts: walletAccounts
          })
        }
      }
      console.info(`[${this.metadata.name}] Session resumed.`)
    } catch (error: any) {
      console.error(`[${this.metadata.name}] Error resuming session:`, error.message)
      throw error
    }
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    if (!this.provider.signTransactions) {
      throw new Error(`[${this.metadata.name}] Method not supported: signTransactions`)
    }
    return await this.provider.signTransactions(txnGroup, indexesToSign)
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!this.provider.transactionSigner) {
      throw new Error(`[${this.metadata.name}] Method not supported: transactionSigner`)
    }
    return await this.provider.transactionSigner(txnGroup, indexesToSign)
  }
}
