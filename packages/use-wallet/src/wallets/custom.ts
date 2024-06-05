import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import { compareAccounts } from 'src/utils'
import { BaseWallet } from './base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from './types'

export type CustomProvider = {
  connect(args?: Record<string, any>): Promise<WalletAccount[]>
  disconnect(): Promise<void>
  resumeSession(): Promise<WalletAccount[] | void>
  signTransactions(
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ): Promise<Uint8Array[]>
  transactionSigner(txnGroup: algosdk.Transaction[], indexesToSign: number[]): Promise<Uint8Array[]>
}

export interface CustomWalletOptions {
  provider: CustomProvider
}

const svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="gray" />
</svg>`

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
    icon: `data:image/svg+xml;base64,${btoa(svgIcon)}`
  }

  public connect = async (args?: Record<string, any>): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    try {
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
    await this.provider.disconnect()
    this.onDisconnect()
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

      const result = await this.provider.resumeSession()

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
    }
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    return await this.provider.signTransactions(txnGroup, indexesToSign, returnGroup)
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    return await this.provider.transactionSigner(txnGroup, indexesToSign)
  }
}
