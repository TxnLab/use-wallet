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
  promptForPassword: () => Promise<string>
}

export type KmdOptions = Partial<Pick<KmdConstructor, 'token' | 'promptForPassword'>> &
  Omit<KmdConstructor, 'token' | 'promptForPassword'> & {
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
  private password: string | null = null

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
      wallet = 'unencrypted-default-wallet',
      promptForPassword = () => Promise.resolve(prompt('KMD password') || '')
    } = options || {}

    this.options = { token, baseServer, port, promptForPassword }
    this.walletName = wallet
    this.store = store
  }

  static defaultMetadata = {
    name: 'KMD',
    icon: ICON
  }

  private async initializeClient(): Promise<algosdk.Kmd> {
    this.logger.info('Initializing client...')
    const { token, baseServer, port } = this.options
    const client = new algosdk.Kmd(token, baseServer, port)
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    if (!this.client) {
      await this.initializeClient()
    }

    try {
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

      this.logger.info('✅ Connected.', walletState)
      return walletAccounts
    } catch (error: any) {
      this.logger.error('Error connecting:', error.message)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    this.onDisconnect()
    this.logger.info('Disconnected.')
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
      await this.initializeClient()
      this.logger.info('Session resumed')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
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

      // Get token and password
      const token = await this.fetchToken()
      const password = await this.getPassword()

      const client = this.client || (await this.initializeClient())

      this.logger.debug('Sending processed transactions to wallet...', txnsToSign)

      // Sign transactions
      const signedTxns = await Promise.all(
        txnsToSign.map((txn) => client.signTransaction(token, password, txn))
      )

      this.logger.debug('Received signed transactions from wallet', signedTxns)

      // Release token
      await this.releaseToken(token)

      this.logger.debug('Transactions signed successfully', signedTxns)
      return signedTxns
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }

  private async fetchWalletId(): Promise<string> {
    this.logger.debug('Fetching wallet data...', { walletName: this.walletName })
    const client = this.client || (await this.initializeClient())

    const { wallets }: ListWalletsResponse = await client.listWallets()
    const wallet = wallets.find((wallet: KmdWalletRecord) => wallet.name === this.walletName)

    if (!wallet) {
      this.logger.error(`Wallet "${this.walletName}" not found!`)
      throw new Error(`Wallet "${this.walletName}" not found!`)
    }

    this.walletId = wallet.id
    this.logger.debug('Wallet data fetched successfully', { walletId: this.walletId })
    return wallet.id
  }

  private async fetchToken(): Promise<string> {
    this.logger.debug('Fetching token...', { walletId: this.walletId })
    const client = this.client || (await this.initializeClient())

    const walletId = this.walletId || (await this.fetchWalletId())
    const password = await this.getPassword()

    const { wallet_handle_token }: InitWalletHandleResponse = await client.initWalletHandle(
      walletId,
      password
    )
    this.logger.debug('Token fetched successfully')
    return wallet_handle_token
  }

  private async releaseToken(token: string): Promise<void> {
    this.logger.debug('Releasing token...')
    const client = this.client || (await this.initializeClient())
    await client.releaseWalletHandle(token)
    this.logger.debug('Token released successfully')
  }

  private async getPassword(): Promise<string> {
    if (this.password !== null) {
      return this.password
    }
    const password = await this.options.promptForPassword()
    this.password = password
    return password
  }

  private async fetchAccounts(token: string): Promise<string[]> {
    this.logger.debug('Fetching accounts...')
    const client = this.client || (await this.initializeClient())
    const { addresses }: ListKeysResponse = await client.listKeys(token)
    this.logger.debug('Accounts fetched successfully', { addresses })
    return addresses
  }
}
