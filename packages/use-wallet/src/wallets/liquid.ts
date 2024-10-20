import { BaseWallet } from 'src/wallets/base'
import { WalletAccount, WalletConstructor, WalletId } from './types'
import { Store } from '@tanstack/store'
import { addWallet, State, WalletState } from 'src/store'
import { Transaction } from 'algosdk'
import { LiquidAuthClient, ICON } from '@algorandfoundation/liquid-auth-use-wallet-client'
import type { LiquidOptions } from '@algorandfoundation/liquid-auth-use-wallet-client'

export { LiquidOptions }

export class LiquidWallet extends BaseWallet {
  protected store: Store<State>
  public authClient: LiquidAuthClient | undefined | null
  private options: LiquidOptions

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.LIQUID>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    this.store = store
    this.options = options ?? {
      RTC_config_username: 'username',
      RTC_config_credential: 'credential'
    }
    this.authClient = new LiquidAuthClient(this.options)
  }

  static defaultMetadata = {
    name: 'Liquid',
    icon: ICON
  }

  public async connect(_args?: Record<string, any>): Promise<WalletAccount[]> {
    this.logger.info('Connecting...')
    if (!this.authClient) {
      this.authClient = new LiquidAuthClient(this.options)
    }

    await this.authClient.connect()

    const sessionData = await this.authClient.checkSession()
    const account = sessionData?.user?.wallet

    if (!account) {
      this.logger.error('No accounts found!')
      throw new Error('No accounts found!')
    }

    const walletAccounts: WalletAccount[] = [
      {
        name: `${this.metadata.name} Account 1`,
        address: account.toString()
      }
    ]

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount: walletAccounts[0]
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    this.logger.info('Connected successfully', walletState)
    this.authClient.hideModal()
    return Promise.resolve(walletAccounts)
  }

  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting...')
    if (!this.authClient) {
      this.logger.error('No auth client found to disconnect from')
      throw new Error('No auth client found to disconnect from')
    }

    await this.authClient.disconnect()
    this.onDisconnect()
    this.logger.info('Disconnected.')
    this.authClient = null
  }

  public resumeSession(): Promise<void> {
    return this.disconnect()
  }

  public async signTransactions<T extends Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })

    try {
      if (!this.activeAddress) {
        throw new Error('No active account')
      }

      return this.authClient!.signTransactions(txnGroup, this.activeAddress, indexesToSign)
    } catch (error) {
      this.logger.error('Error signing transactions', error)
      throw error
    }
  }
}
