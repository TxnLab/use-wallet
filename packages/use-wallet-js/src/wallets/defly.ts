import algosdk from 'algosdk'
import { addWallet, setAccounts, type State } from 'src/store'
import {
  compareAccounts,
  isSignedTxnObject,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'
import { BaseWallet } from './base'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { Store } from '@tanstack/store'
import type { SignerTransaction, WalletAccount, WalletConstructor, WalletId } from './types'

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
    console.info('[DeflyWallet] Initializing client...')
    const module = await import('@blockshake/defly-connect')
    const DeflyWalletConnect = module.default
      ? module.default.DeflyWalletConnect
      : module.DeflyWalletConnect

    const client = new DeflyWalletConnect(this.options)
    client.connector?.on('disconnect', this.onDisconnect)
    this.client = client
    return client
  }

  public async connect(): Promise<WalletAccount[]> {
    console.info('[DeflyWallet] Connecting...')
    try {
      const client = this.client || (await this.initializeClient())
      const accounts = await client.connect()

      if (accounts.length === 0) {
        throw new Error('No accounts found!')
      }

      const walletAccounts = accounts.map((address: string, idx: number) => ({
        name: `Defly Wallet ${idx + 1}`,
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

      return walletAccounts
    } catch (error: any) {
      if (error?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        console.error(`[DeflyWallet] Error connecting: ${error.message}`)
      } else {
        console.info('[DeflyWallet] Connection cancelled.')
      }
      return []
    }
  }

  public async disconnect(): Promise<void> {
    console.info('[DeflyWallet] Disconnecting...')
    try {
      await this.client?.disconnect()
      this.onDisconnect()
    } catch (error: any) {
      console.error(error)
    }
  }

  public async resumeSession(): Promise<void> {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      // No session to resume
      if (!walletState) {
        return
      }

      console.info('[DeflyWallet] Resuming session...')

      const client = this.client || (await this.initializeClient())
      const accounts = await client.reconnectSession()

      if (accounts.length === 0) {
        throw new Error('[DeflyWallet] No accounts found!')
      }

      const walletAccounts = accounts.map((address: string, idx: number) => ({
        name: `Defly Wallet ${idx + 1}`,
        address
      }))

      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        console.warn(`[DeflyWallet] Session accounts mismatch, updating accounts`)
        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
    } catch (error: any) {
      console.error(error)
      this.onDisconnect()
    }
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    if (!this.client) {
      throw new Error('[DeflyWallet] Client not initialized!')
    }
    const txnsToSign: SignerTransaction[] = []
    const signedIndexes: number[] = []

    const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)

    // Decode transactions to access properties
    const decodedObjects = msgpackTxnGroup.map((txn) => {
      return algosdk.decodeObj(txn)
    }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

    // Marshal transactions into `SignerTransaction[]`
    decodedObjects.forEach((txnObject, idx) => {
      const isSigned = isSignedTxnObject(txnObject)
      const shouldSign = shouldSignTxnObject(txnObject, this.addresses, indexesToSign, idx)

      const txnBuffer: Uint8Array = msgpackTxnGroup[idx]!
      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      if (shouldSign) {
        txnsToSign.push({ txn })
        signedIndexes.push(idx)
      } else {
        txnsToSign.push({ txn, signers: [] })
      }
    })

    // Sign transactions
    const signedTxns = await this.client.signTransaction([txnsToSign])

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
      throw new Error('[DeflyWallet] Client not initialized!')
    }

    const txnsToSign = txnGroup.reduce<SignerTransaction[]>((acc, txn, idx) => {
      if (indexesToSign.includes(idx)) {
        acc.push({ txn })
      } else {
        acc.push({ txn, signers: [] })
      }
      return acc
    }, [])

    const signTxnsResult = await this.client.signTransaction([txnsToSign])
    return signTxnsResult
  }
}
