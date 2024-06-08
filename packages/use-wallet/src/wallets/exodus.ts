import algosdk from 'algosdk'
import { WalletState, addWallet, type State } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray
} from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type {
  WalletAccount,
  WalletConstructor,
  WalletId,
  WalletTransaction
} from 'src/wallets/types'

/** @see https://docs.exodus.com/api-reference/algorand-provider-arc-api/ */

interface EnableNetworkOpts {
  genesisID?: string
  genesisHash?: string
}

interface EnableAccountsOpts {
  accounts?: string[]
}

export type ExodusOptions = EnableNetworkOpts & EnableAccountsOpts

interface EnableNetworkResult {
  genesisID: string
  genesisHash: string
}

interface EnableAccountsResult {
  accounts: string[]
}

export type EnableResult = EnableNetworkResult & EnableAccountsResult

export type SignTxnsResult = (string | null)[]

export interface Exodus {
  isConnected: boolean
  address: string | null
  enable: (options?: ExodusOptions) => Promise<EnableResult>
  signTxns: (transactions: WalletTransaction[]) => Promise<SignTxnsResult>
}

export type WindowExtended = { algorand: Exodus } & Window & typeof globalThis

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDI2LjUuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAzMDAgMzAwIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzMDAgMzAwOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6dXJsKCNTVkdJRF8xXyk7fQoJLnN0MXtmaWxsOnVybCgjU1ZHSURfMDAwMDAwNDM0MjYxNjcxNDAxMDY1ODIyNzAwMDAwMDIxMzA3Njg5MDYwNzMxMTM0ODRfKTt9Cgkuc3Qye2ZpbGw6dXJsKCNTVkdJRF8wMDAwMDEwMjUxOTMxNjAxNTI3NjU4MTY0MDAwMDAxNjI3NDExMjM4MzE3NTY0MTc1OV8pO2ZpbHRlcjp1cmwoI0Fkb2JlX09wYWNpdHlNYXNrRmlsdGVyKTt9Cgkuc3Qze2ZpbGw6dXJsKCNTVkdJRF8wMDAwMDEzODU2MzM4MjQ2MjA4NjAyMDM1MDAwMDAxNDg3ODQ5MDI3MDc4MjA3MTIwN18pO30KCS5zdDR7bWFzazp1cmwoI21hc2swXzE2NjFfMjk1XzAwMDAwMDg4MTMyMjUxNTk3NDQxNTczNDkwMDAwMDExNjkzNjEyMDE4NTA2NjgxNDgxXyk7fQoJLnN0NXtmaWxsOnVybCgjU1ZHSURfMDAwMDAxMDYxMjA2MzI0NjE3OTI4NzExNjAwMDAwMDc0MzM5MTMwMzgzMzc3NjY1NzZfKTt9Cjwvc3R5bGU+CjxnPgoJCgkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8xXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIyNDYuNjAzIiB5MT0iOS4yMjEyIiB4Mj0iMTc0LjE1OCIgeTI9IjMwOC41NDI2IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgMzAyKSI+CgkJPHN0b3AgIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzBCNDZGOSIvPgoJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNCQkZCRTAiLz4KCTwvbGluZWFyR3JhZGllbnQ+Cgk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMjc0LjcsOTMuOUwxNjYuNiwyM3YzOS42bDY5LjQsNDUuMWwtOC4yLDI1LjhoLTYxLjJ2MzIuOWg2MS4ybDguMiwyNS44bC02OS40LDQ1LjFWMjc3bDEwOC4yLTcwLjdMMjU3LDE1MC4xCgkJTDI3NC43LDkzLjl6Ii8+CgkKCQk8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzAwMDAwMDE4MjI4MjM3MTUxMjM5MTUxMzIwMDAwMDE3ODM4NjY0MjU5NzY2MjczOTI1XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMjkuMzUxNiIgeTE9Ii0xOS4xNTczIiB4Mj0iNTYuOTA2NiIgeTI9IjI4MC4xNjQxIiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgMzAyKSI+CgkJPHN0b3AgIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzBCNDZGOSIvPgoJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNCQkZCRTAiLz4KCTwvbGluZWFyR3JhZGllbnQ+Cgk8cGF0aCBzdHlsZT0iZmlsbDp1cmwoI1NWR0lEXzAwMDAwMDE4MjI4MjM3MTUxMjM5MTUxMzIwMDAwMDE3ODM4NjY0MjU5NzY2MjczOTI1Xyk7IiBkPSJNNzIuNSwxNjYuNGg2MXYtMzIuOUg3Mi4ybC03LjktMjUuOAoJCWw2OS4yLTQ1LjFWMjNMMjUuMyw5My45TDQzLDE1MC4xbC0xNy43LDU2LjJMMTMzLjcsMjc3di0zOS42bC02OS40LTQ1LjFMNzIuNSwxNjYuNHoiLz4KCTxkZWZzPgoJCTxmaWx0ZXIgaWQ9IkFkb2JlX09wYWNpdHlNYXNrRmlsdGVyIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIHg9IjI1LjQiIHk9IjIzIiB3aWR0aD0iMjQ3LjYiIGhlaWdodD0iMjU0Ij4KCQkJPGZlQ29sb3JNYXRyaXggIHR5cGU9Im1hdHJpeCIgdmFsdWVzPSIxIDAgMCAwIDAgIDAgMSAwIDAgMCAgMCAwIDEgMCAwICAwIDAgMCAxIDAiLz4KCQk8L2ZpbHRlcj4KCTwvZGVmcz4KCQoJCTxtYXNrIG1hc2tVbml0cz0idXNlclNwYWNlT25Vc2UiIHg9IjI1LjQiIHk9IjIzIiB3aWR0aD0iMjQ3LjYiIGhlaWdodD0iMjU0IiBpZD0ibWFzazBfMTY2MV8yOTVfMDAwMDAwODgxMzIyNTE1OTc0NDE1NzM0OTAwMDAwMTE2OTM2MTIwMTg1MDY2ODE0ODFfIj4KCQkKCQkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8wMDAwMDE2NTkyOTcyNDMwMzE2NDIwMzAwMDAwMDAwNzEwMTkwNDk4NDUxOTkxNTE2Ml8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iMjQ2LjYwMzgiIHkxPSI5LjIyMTQiIHgyPSIxNzQuMTU4OCIgeTI9IjMwOC41NDI4IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIC0xIDAgMzAyKSI+CgkJCTxzdG9wICBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiMwQjQ2RjkiLz4KCQkJPHN0b3AgIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6I0JCRkJFMCIvPgoJCTwvbGluZWFyR3JhZGllbnQ+CgkJPHBhdGggc3R5bGU9ImZpbGw6dXJsKCNTVkdJRF8wMDAwMDE2NTkyOTcyNDMwMzE2NDIwMzAwMDAwMDAwNzEwMTkwNDk4NDUxOTkxNTE2Ml8pO2ZpbHRlcjp1cmwoI0Fkb2JlX09wYWNpdHlNYXNrRmlsdGVyKTsiIGQ9IgoJCQlNMjc0LjcsOTMuOUwxNjYuNiwyM3YzOS42bDY5LjQsNDUuMWwtOC4yLDI1LjhoLTYxLjJ2MzIuOWg2MS4ybDguMiwyNS44bC02OS40LDQ1LjFWMjc3bDEwOC4yLTcwLjdMMjU3LDE1MC4xTDI3NC43LDkzLjl6Ii8+CgkJCgkJCTxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMDAwMDAxMTk4MTE3MDc2MjE0NzI4MTQyNzAwMDAwMTA4Mjk2NTkzODM4NTEyMDI0OTFfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjEyOS4zNTIxIiB5MT0iLTE5LjE1NzEiIHgyPSI1Ni45MDcxIiB5Mj0iMjgwLjE2NDIiIGdyYWRpZW50VHJhbnNmb3JtPSJtYXRyaXgoMSAwIDAgLTEgMCAzMDIpIj4KCQkJPHN0b3AgIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6IzBCNDZGOSIvPgoJCQk8c3RvcCAgb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojQkJGQkUwIi8+CgkJPC9saW5lYXJHcmFkaWVudD4KCQk8cGF0aCBzdHlsZT0iZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTE5ODExNzA3NjIxNDcyODE0MjcwMDAwMDEwODI5NjU5MzgzODUxMjAyNDkxXyk7IiBkPSJNNzIuNSwxNjYuNGg2MXYtMzIuOUg3Mi4ybC03LjktMjUuOAoJCQlsNjkuMi00NS4xVjIzTDI1LjMsOTMuOUw0MywxNTAuMWwtMTcuNyw1Ni4yTDEzMy43LDI3N3YtMzkuNmwtNjkuNC00NS4xTDcyLjUsMTY2LjR6Ii8+Cgk8L21hc2s+Cgk8ZyBjbGFzcz0ic3Q0Ij4KCQkKCQkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8wMDAwMDEwOTAxOTkxODU1Nzc3MzA1MzQyMDAwMDAxNzYwMjQwNTkwODA2NzEyMDMwMF8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iNDYuNDY2MiIgeTE9IjIyOC43NTU0IiB4Mj0iMTcxLjg2MzgiIHkyPSIxMzUuMTAzOSIgZ3JhZGllbnRUcmFuc2Zvcm09Im1hdHJpeCgxIDAgMCAtMSAwIDMwMikiPgoJCQk8c3RvcCAgb2Zmc2V0PSIwLjExOTgiIHN0eWxlPSJzdG9wLWNvbG9yOiM4OTUyRkY7c3RvcC1vcGFjaXR5OjAuODciLz4KCQkJPHN0b3AgIG9mZnNldD0iMSIgc3R5bGU9InN0b3AtY29sb3I6I0RBQkRGRjtzdG9wLW9wYWNpdHk6MCIvPgoJCTwvbGluZWFyR3JhZGllbnQ+CgkJCgkJCTxyZWN0IHg9IjI1LjQiIHk9IjIzIiBzdHlsZT0iZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTA5MDE5OTE4NTU3NzczMDUzNDIwMDAwMDE3NjAyNDA1OTA4MDY3MTIwMzAwXyk7IiB3aWR0aD0iMjQ3LjYiIGhlaWdodD0iMjU0Ii8+Cgk8L2c+CjwvZz4KPC9zdmc+Cg=='

export class ExodusWallet extends BaseWallet {
  private client: Exodus | null = null
  private options: ExodusOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options = {},
    metadata = {}
  }: WalletConstructor<WalletId.EXODUS>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.options = options
    this.store = store
  }

  static defaultMetadata = { name: 'Exodus', icon }

  private async initializeClient(): Promise<Exodus> {
    console.info(`[${this.metadata.name}] Initializing client...`)
    if (typeof window === 'undefined' || (window as WindowExtended).algorand === undefined) {
      throw new Error('Exodus is not available.')
    }
    const client = (window as WindowExtended).algorand
    this.client = client
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    const client = this.client || (await this.initializeClient())
    const { accounts } = await client.enable(this.options)

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
      const client = await this.initializeClient()

      if (!client.isConnected) {
        throw new Error('Exodus is not connected.')
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
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = this.addresses.includes(signer)

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

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

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<Uint8Array[]> => {
    let txnsToSign: WalletTransaction[] = []

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
    const signTxnsResult = await client.signTxns(txnsToSign)

    // Filter out null values and convert to Uint8Array[]
    const signedTxns = signTxnsResult.reduce<Uint8Array[]>((acc, value) => {
      if (value !== null) {
        const signedTxn = base64ToByteArray(value)
        acc.push(signedTxn)
      }
      return acc
    }, [])

    return signedTxns
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    return this.signTransactions(txnGroup, indexesToSign)
  }
}
