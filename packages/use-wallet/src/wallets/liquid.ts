import { BaseWallet } from 'src/wallets/base'
import { WalletAccount, WalletConstructor, WalletId } from './types'
import { Store } from '@tanstack/store'
import { addWallet, State, WalletState } from 'src/store'
import { Transaction } from 'algosdk'
import type {
  LiquidAuthClient,
  LiquidOptions
} from '@algorandfoundation/liquid-auth-use-wallet-client'

export { LiquidOptions }

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="249" height="249" viewBox="0 0 249 249" xml:space="preserve">
  <g transform="matrix(2.52 0 0 2.52 124.74 124.74)">
    <circle style="stroke: rgb(0,0,0); stroke-width: 19; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(0,0,0); fill-rule: nonzero; opacity: 1;" cx="0" cy="0" r="40"/>
  </g>
  <g transform="matrix(-1.16 -0.01 0.01 -0.97 125.63 187.7)">
    <path style="stroke: rgb(0,0,0); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(170,0,255); fill-rule: nonzero; opacity: 1;" transform=" translate(-57.95, -28.98)" d="m 0 57.952755 l 0 0 c 0 -32.006424 25.946333 -57.952755 57.952755 -57.952755 c 32.006428 0 57.952755 25.946333 57.952755 57.952755 l -28.97638 0 c 0 -16.003212 -12.97316 -28.976377 -28.976376 -28.976377 c -16.003212 0 -28.976377 12.9731655 -28.976377 28.976377 z" stroke-linecap="round"/>
  </g>
  <g transform="matrix(1.16 0 0 2.21 126.06 96.74)">
    <path style="stroke: rgb(255,4,233); stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-dashoffset: 0; stroke-linejoin: miter; stroke-miterlimit: 4; fill: rgb(170,0,255); fill-rule: nonzero; opacity: 1;" transform=" translate(-57.95, -28.98)" d="m 0 57.952755 l 0 0 c 0 -32.006424 25.946333 -57.952755 57.952755 -57.952755 c 32.006428 0 57.952755 25.946333 57.952755 57.952755 l -28.97638 0 c 0 -16.003212 -12.97316 -28.976377 -28.976376 -28.976377 c -16.003212 0 -28.976377 12.9731655 -28.976377 28.976377 z" stroke-linecap="round"/>
  </g>
</svg>
`)}`

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
  }

  static defaultMetadata = {
    name: 'Liquid',
    icon: ICON
  }

  private async initializeClient(): Promise<LiquidAuthClient> {
    this.logger.info('Initializing client...')
    const { LiquidAuthClient } = await import('@algorandfoundation/liquid-auth-use-wallet-client')

    const client = new LiquidAuthClient(this.options)
    this.authClient = client
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (_args?: Record<string, any>): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const authClient = this.authClient || (await this.initializeClient())

    await authClient.connect()

    const sessionData = await authClient.checkSession()
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
    authClient.hideModal()
    return Promise.resolve(walletAccounts)
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    if (!this.authClient) {
      this.logger.error('No auth client to disconnect')
      throw new Error('No auth client to disconnect')
    }

    await this.authClient.disconnect()
    this.onDisconnect()
    this.logger.info('Disconnected.')
    this.authClient = null
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
      this.disconnect()
    } catch (error) {
      this.logger.error('Error resuming session', error)
      this.onDisconnect()
      throw error
    }
  }

  public signTransactions = async <T extends Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    try {
      if (!this.activeAddress) {
        throw new Error('No active account')
      }
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })

      const authClient = this.authClient || (await this.initializeClient())
      // @ts-expect-error - TODO: update liquid-auth-use-wallet-client to use algosdk v3
      return authClient.signTransactions(txnGroup, this.activeAddress, indexesToSign)
    } catch (error) {
      this.logger.error('Error signing transactions', error)
      throw error
    }
  }
}
