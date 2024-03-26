import algosdk from 'algosdk'
import { addWallet, type State } from 'src/store'
import {
  isSignedTxnObject,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'
import { BaseWallet } from './base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from './types'

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

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDkuODMgMjEwLjMzIj48dGV4dCB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwIDE2MS4zMSkiIHN0eWxlPSJmb250LWZhbWlseTpJQk1QbGV4U2Fucy1NZWRtLCAmYXBvcztJQk0gUGxleCBTYW5zJmFwb3M7OyBmb250LXNpemU6MTkwcHg7Ij48dHNwYW4geD0iMCIgeT0iMCI+S01EPC90c3Bhbj48L3RleHQ+PC9zdmc+'

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

  static defaultMetadata = { name: 'KMD', icon }

  private async initializeClient(): Promise<algosdk.Kmd> {
    console.info('[KmdWallet] Initializing client...')
    const { token, baseServer, port } = this.options
    const client = new algosdk.Kmd(token, baseServer, port)
    this.client = client
    return client
  }

  public async connect(): Promise<WalletAccount[]> {
    console.info('[KmdWallet] Connecting...')
    try {
      if (!this.client) {
        await this.initializeClient()
      }

      // Get a new token
      const walletId = this.walletId || (await this.fetchWalletId())
      const token = await this.fetchToken(walletId, this.getPassword())

      const accounts = await this.fetchAccounts(token)

      if (accounts.length === 0) {
        throw new Error('No accounts found!')
      }

      const walletAccounts = accounts.map((address: string, idx: number) => ({
        name: `KMD Wallet ${idx + 1}`,
        address
      }))

      const activeAccount = walletAccounts[0]!

      addWallet(this.store, {
        walletId: this.id,
        wallet: {
          accounts: walletAccounts,
          activeAccount
        }
      })

      await this.releaseToken(token)

      return walletAccounts
    } catch (error) {
      console.error('[KmdWallet] Error connecting:', error)
      return []
    }
  }

  public async disconnect(): Promise<void> {
    console.info('[KmdWallet] Disconnecting...')
    this.onDisconnect()
  }

  public resumeSession(): Promise<void> {
    return Promise.resolve()
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    if (!this.client) {
      throw new Error('[KmdWallet] Client not initialized!')
    }
    // Get a new token
    const walletId = this.walletId || (await this.fetchWalletId())
    const password = this.getPassword()
    const token = await this.fetchToken(walletId, password)

    const signTxnPromises: Promise<Uint8Array>[] = []
    const signedIndexes: number[] = []

    const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)

    // Decode transactions to access properties
    const decodedObjects = msgpackTxnGroup.map((txn) => {
      return algosdk.decodeObj(txn)
    }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

    // Determine which transactions to sign
    decodedObjects.forEach((txnObject, idx) => {
      const isSigned = isSignedTxnObject(txnObject)
      const shouldSign = shouldSignTxnObject(txnObject, this.addresses, indexesToSign, idx)

      const txnBuffer: Uint8Array = msgpackTxnGroup[idx]!
      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      if (shouldSign) {
        signTxnPromises.push(this.client!.signTransaction(token, password, txn))
        signedIndexes.push(idx)
      }
    })

    // Sign transactions
    const signedTxns = await Promise.all(signTxnPromises)

    // Release token
    await this.releaseToken(token)

    // Merge signed transactions back into original group
    const txnGroupSigned = mergeSignedTxnsWithGroup(
      signedTxns,
      msgpackTxnGroup,
      signedIndexes,
      returnGroup
    )

    return txnGroupSigned
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!this.client) {
      throw new Error('[KmdWallet] Client not initialized!')
    }
    const walletId = this.walletId || (await this.fetchWalletId())
    const password = this.getPassword()
    const token = await this.fetchToken(walletId, password)

    const signTxnPromises: Promise<Uint8Array>[] = []

    txnGroup.forEach((txn, idx) => {
      if (indexesToSign.includes(idx)) {
        signTxnPromises.push(this.client!.signTransaction(token, password, txn))
      }
    })

    const signedTxns = await Promise.all(signTxnPromises)

    return signedTxns
  }

  private async fetchWalletId(): Promise<string> {
    console.info('[KmdWallet] Fetching wallet data...')
    if (!this.client) {
      throw new Error('Client not initialized!')
    }
    const { wallets }: ListWalletsResponse = await this.client.listWallets()
    const wallet = wallets.find((wallet: KmdWalletRecord) => wallet.name === this.walletName)
    if (!wallet) {
      throw new Error(`Wallet ${this.walletName} not found!`)
    }

    this.walletId = wallet.id
    return wallet.id
  }

  private async fetchToken(walletId: string, password: string): Promise<string> {
    console.info('[KmdWallet] Fetching token...')
    if (!this.client) {
      throw new Error('Client not initialized!')
    }
    const { wallet_handle_token }: InitWalletHandleResponse = await this.client.initWalletHandle(
      walletId,
      password
    )
    return wallet_handle_token
  }

  private async fetchAccounts(token: string): Promise<string[]> {
    console.info('[KmdWallet] Fetching accounts...')
    if (!this.client) {
      throw new Error('Client not initialized!')
    }
    const { addresses }: ListKeysResponse = await this.client.listKeys(token)
    return addresses
  }

  private async releaseToken(token: string): Promise<void> {
    console.info('[KmdWallet] Releasing token...')
    if (!this.client) {
      throw new Error('Client not initialized!')
    }
    await this.client.releaseWalletHandle(token)
  }

  private getPassword(): string {
    if (this.password) {
      return this.password
    }
    const password = prompt('KMD password') || ''
    this.password = password
    return password
  }
}
