import algosdk from 'algosdk'
import {
  BaseWallet,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type WalletAccount,
  type WalletMetadata,
  type WalletState
} from '@txnlab/use-wallet/adapter'

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

import { icon } from './icon'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

export class KmdAdapter extends BaseWallet<KmdOptions> {
  private client: algosdk.Kmd | null = null
  private kmdOptions: KmdConstructor
  private walletName: string
  private kmdWalletId: string = ''
  private password: string | null = null

  constructor(params: AdapterConstructorParams<KmdOptions>) {
    super(params)

    const {
      token = 'a'.repeat(64),
      baseServer = 'http://127.0.0.1',
      port = 4002,
      wallet = 'unencrypted-default-wallet',
      promptForPassword = () => Promise.resolve(prompt('KMD password') || '')
    } = this.options || {}

    this.kmdOptions = { token, baseServer, port, promptForPassword }
    this.walletName = wallet
  }

  static defaultMetadata: WalletMetadata = {
    name: 'KMD',
    icon: ICON
  }

  private async initializeClient(): Promise<algosdk.Kmd> {
    this.logger.info('Initializing client...')
    const { token, baseServer, port } = this.kmdOptions
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

      this.store.addWallet(walletState)

      // Release token
      await this.releaseToken(token)

      this.logger.info('Connected successfully', walletState)
      return walletAccounts
    } catch (error: any) {
      this.logger.error('Error connecting:', error.message)
      throw error
    }
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    this.onDisconnect()
    this.logger.info('Disconnected')
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
      const signer = txn.sender.toString()
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
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
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

    this.kmdWalletId = wallet.id
    this.logger.debug('Wallet data fetched successfully', { walletId: this.kmdWalletId })
    return wallet.id
  }

  private async fetchToken(): Promise<string> {
    this.logger.debug('Fetching token...', { walletId: this.kmdWalletId })
    const client = this.client || (await this.initializeClient())

    const walletId = this.kmdWalletId || (await this.fetchWalletId())
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
    const password = await this.kmdOptions.promptForPassword()
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
