import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import { compareAccounts, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { Store } from '@tanstack/store'
import type {
  SignerTransaction,
  WalletAccount,
  WalletConstructor,
  WalletId
} from 'src/wallets/types'

export interface DeflyWalletConnectOptions {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
}

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+Cjxzdmcgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWw6c3BhY2U9InByZXNlcnZlIiB4bWxuczpzZXJpZj0iaHR0cDovL3d3dy5zZXJpZi5jb20vIiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjI7Ij4KICAgIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiLz4KICAgIDxnIHRyYW5zZm9ybT0ibWF0cml4KDEuNjgyMDksMCwwLDEuNjgyMDksMjI2LjM2OCwyMTIuODE4KSI+CiAgICAgICAgPHBhdGggZD0iTTMyNy4wNDksMjgwLjE5MkwxNjkuNTI0LDEzTDEyLDI4MC4xOTJMMTY5LjUyNCwxODkuMDg0TDMyNy4wNDksMjgwLjE5MloiIHN0eWxlPSJmaWxsOndoaXRlO2ZpbGwtcnVsZTpub256ZXJvOyIvPgogICAgPC9nPgogICAgPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS42ODIwOSwwLDAsMS42ODIwOSwyMjYuMzY4LDIxMi44MTgpIj4KICAgICAgICA8cGF0aCBkPSJNMjk5LjU0NiwzMDdMMTY5LjUyNSwyMzguNDczTDM5LjUwNCwzMDdMMTY5LjUyNSwyNjQuNjdMMjk5LjU0NiwzMDdaIiBzdHlsZT0iZmlsbDp3aGl0ZTtmaWxsLXJ1bGU6bm9uemVybzsiLz4KICAgIDwvZz4KPC9zdmc+Cg=='

export class DeflyWallet extends BaseWallet {
  private client: DeflyWalletConnect | null = null
  private options: DeflyWalletConnectOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options = {},
    metadata = {}
  }: WalletConstructor<WalletId.DEFLY>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.options = options
    this.store = store
  }

  static defaultMetadata = { name: 'Defly', icon }

  private async initializeClient(): Promise<DeflyWalletConnect> {
    console.info(`[${this.metadata.name}] Initializing client...`)
    const module = await import('@blockshake/defly-connect')
    const DeflyWalletConnect = module.default
      ? module.default.DeflyWalletConnect
      : module.DeflyWalletConnect

    const client = new DeflyWalletConnect(this.options)
    client.connector?.on('disconnect', this.onDisconnect)
    this.client = client
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    const client = this.client || (await this.initializeClient())
    const accounts = await client.connect()

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

    console.info(`[${this.metadata.name}] ✅ Connected.`, walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    console.info(`[${this.metadata.name}] Disconnecting...`)
    this.onDisconnect()
    const client = this.client || (await this.initializeClient())
    await client.disconnect()
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

      const client = this.client || (await this.initializeClient())
      const accounts = await client.reconnectSession()

      if (accounts.length === 0) {
        throw new Error('No accounts found!')
      }

      const walletAccounts = accounts.map((address: string, idx: number) => ({
        name: `${this.metadata.name} Account ${idx + 1}`,
        address
      }))

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
    } catch (error: any) {
      console.error(`[${this.metadata.name}] Error resuming session: ${error.message}`)
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): SignerTransaction[] {
    const txnsToSign: SignerTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = this.addresses.includes(signer)

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn })
      } else {
        txnsToSign.push({ txn, signers: [] })
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): SignerTransaction[] {
    const txnsToSign: SignerTransaction[] = []

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
        txnsToSign.push({ txn })
      } else {
        txnsToSign.push({ txn, signers: [] })
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<Uint8Array[]> => {
    let txnsToSign: SignerTransaction[] = []

    // Determine type and process transactions for signing
    if (isTransactionArray(txnGroup)) {
      const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
      txnsToSign = this.processTxns(flatTxns, indexesToSign)
    } else {
      const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
      txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
    }

    const client = this.client || (await this.initializeClient())

    // Sign transactions
    const signedTxns = await client.signTransaction([txnsToSign])
    return signedTxns
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    return this.signTransactions(txnGroup, indexesToSign)
  }
}
