import algosdk from 'algosdk'
import { WalletState, addWallet, type State } from 'src/store'
import { flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from 'src/wallets/types'

interface KmdConstructor {
  token: string | algosdk.KMDTokenHeader | algosdk.CustomTokenHeader
  baseServer?: string
  port?: string | number
  headers?: Record<string, string>
}

export type KmdOptions = Partial<Pick<KmdConstructor, 'token'>> &
  Omit<KmdConstructor, 'token'> & {
    wallet?: string
  }

interface KmdWalletRecord {
  id: string
  name: string
  driver_name?: string
  driver_version?: number
  mnemonic_ux?: boolean
  supported_txs?: Array<any>
}

interface ListWalletsResponse {
  wallets: KmdWalletRecord[]
  message?: string
  error?: boolean
}

interface InitWalletHandleResponse {
  wallet_handle_token: string
  message?: string
  error?: boolean
}

interface ListKeysResponse {
  addresses: string[]
  message?: string
  error?: boolean
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <linearGradient id="algokitGradient" gradientUnits="userSpaceOnUse" x1="0" y1="400" x2="400" y2="0">
    <stop offset="0" style="stop-color:#31D8EE"/>
    <stop offset="1" style="stop-color:#01DC94"/>
  </linearGradient>
  <rect fill="url(#algokitGradient)" width="400" height="400" />
  <path fill="#FFFFFF" d="M309.2,309.3H275l-22.2-82.7l-47.9,82.7h-38.3l73.9-128l-11.9-44.5l-99.6,172.6H90.8L217.1,90.6 h33.5l14.7,54.3h34.6l-23.6,41L309.2,309.3z" />
</svg>
`)}`

export class KmdWallet extends BaseWallet {
  private client: algosdk.Kmd | null = null
  private options: KmdConstructor
  private walletName: string
  private walletId: string = ''
  private password: string = ''

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.KMD>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    const {
      token = 'a'.repeat(64),
      baseServer = 'http://127.0.0.1',
      port = 4002,
      wallet = 'unencrypted-default-wallet'
    } = options || {}

    this.options = { token, baseServer, port }
    this.walletName = wallet

    this.store = store
  }

  static defaultMetadata = {
    name: 'KMD',
    icon: ICON
  }

  private async initializeClient(): Promise<algosdk.Kmd> {
    console.info(`[${this.metadata.name}] Initializing client...`)
    const { token, baseServer, port } = this.options
    const client = new algosdk.Kmd(token, baseServer, port)
    this.client = client
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    if (!this.client) {
      await this.initializeClient()
    }

    // Get token and fetch accounts
    const token = await this.fetchToken()
    const accounts = await this.fetchAccounts(token)

    if (accounts.length === 0) {
      throw new Error('No accounts found!')
    }

    const walletAccounts = accounts.map((address: string, idx: number) => ({
      name: `${this.metadata.name} Account ${idx + 1}`,
      address
    }))

    const activeAccount = walletAccounts[0]

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    // Release token
    await this.releaseToken(token)

    console.info(`[${this.metadata.name}] ✅ Connected.`, walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    this.onDisconnect()
    console.info(`[${this.metadata.name}] Disconnected.`)
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
      await this.initializeClient()
    } catch (error: any) {
      console.error(`[${this.metadata.name}] Error resuming session: ${error.message}`)
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = this.addresses.includes(signer)

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

    txnGroup.forEach((txnBuffer, index) => {
      const txnDecodeObj = algosdk.decodeObj(txnBuffer) as
        | algosdk.EncodedTransaction
        | algosdk.EncodedSignedTransaction

      const isSigned = isSignedTxn(txnDecodeObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = !isSigned && this.addresses.includes(signer)

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    let txnsToSign: algosdk.Transaction[] = []

    // Determine type and process transactions for signing
    if (isTransactionArray(txnGroup)) {
      const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
      txnsToSign = this.processTxns(flatTxns, indexesToSign)
    } else {
      const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
      txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
    }

    // Get token and password
    const token = await this.fetchToken()
    const password = this.getPassword()

    const client = this.client || (await this.initializeClient())

    // Sign transactions
    const signedTxns = await Promise.all(
      txnsToSign.map((txn) => client.signTransaction(token, password, txn))
    )

    // Release token
    await this.releaseToken(token)

    return signedTxns
  }

  private async fetchWalletId(): Promise<string> {
    console.info(`[${this.metadata.name}] Fetching wallet data...`)
    const client = this.client || (await this.initializeClient())

    const { wallets }: ListWalletsResponse = await client.listWallets()
    const wallet = wallets.find((wallet: KmdWalletRecord) => wallet.name === this.walletName)

    if (!wallet) {
      throw new Error(`Wallet "${this.walletName}" not found!`)
    }

    this.walletId = wallet.id
    return wallet.id
  }

  private async fetchToken(): Promise<string> {
    console.info(`[${this.metadata.name}] Fetching token...`)
    const client = this.client || (await this.initializeClient())

    const walletId = this.walletId || (await this.fetchWalletId())
    const password = this.getPassword()

    const { wallet_handle_token }: InitWalletHandleResponse = await client.initWalletHandle(
      walletId,
      password
    )
    return wallet_handle_token
  }

  private async releaseToken(token: string): Promise<void> {
    console.info(`[${this.metadata.name}] Releasing token...`)
    const client = this.client || (await this.initializeClient())
    await client.releaseWalletHandle(token)
  }

  private getPassword(): string {
    if (this.password) {
      return this.password
    }
    const password = prompt('KMD password') || ''
    this.password = password
    return password
  }

  private async fetchAccounts(token: string): Promise<string[]> {
    console.info(`[${this.metadata.name}] Fetching accounts...`)
    const client = this.client || (await this.initializeClient())
    const { addresses }: ListKeysResponse = await client.listKeys(token)
    return addresses
  }
}
