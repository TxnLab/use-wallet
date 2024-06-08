import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import { compareAccounts, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { PeraWalletConnect } from '@perawallet/connect-beta'
import type { Store } from '@tanstack/store'
import type {
  SignerTransaction,
  WalletAccount,
  WalletConstructor,
  WalletId
} from 'src/wallets/types'

export interface PeraWalletConnectOptions {
  projectId: string
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
  compactMode?: boolean
}

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNzcgMTg3Ij48cmVjdCB4PSItMTEuMzgiIHk9Ii0yNS45NyIgd2lkdGg9IjIwMC4wMiIgaGVpZ2h0PSIyMzEuNTMiIHN0eWxlPSJmaWxsOiNmZTU7Ii8+PHBhdGggZD0iTTk0LjA1LDU5LjYxYzIuMDUsOC40OCwxLjM2LDE1Ljk0LTEuNTUsMTYuNjYtMi45LC43Mi02LjkxLTUuNTctOC45Ni0xNC4wNS0yLjA1LTguNDgtMS4zNi0xNS45NCwxLjU1LTE2LjY2LDIuOS0uNzIsNi45MSw1LjU3LDguOTYsMTQuMDVaIiBzdHlsZT0iZmlsbDojMWMxYzFjOyIvPjxwYXRoIGQ9Ik0xMjcuODUsNjYuOWMtNC41My00LjgxLTEzLjU1LTMuNS0yMC4xNSwyLjkxLTYuNTksNi40MS04LjI2LDE1LjUtMy43MywyMC4zMSw0LjUzLDQuOCwxMy41NSwzLjUsMjAuMTUtMi45MXM4LjI2LTE1LjUsMy43My0yMC4zMVoiIHN0eWxlPSJmaWxsOiMxYzFjMWM7Ii8+PHBhdGggZD0iTTkxLjc5LDE0MC40N2MyLjktLjcyLDMuNDktOC42LDEuMzItMTcuNjEtMi4xNy05LTYuMjktMTUuNzEtOS4xOS0xNC45OS0yLjksLjcyLTMuNDksOC42LTEuMzIsMTcuNjEsMi4xNyw5LDYuMjksMTUuNzEsOS4xOSwxNC45OVoiIHN0eWxlPSJmaWxsOiMxYzFjMWM7Ii8+PHBhdGggZD0iTTYyLjIyLDcxLjNjOC4zNywyLjQ3LDE0LjQ4LDYuOCwxMy42Niw5LjY3LS44MywyLjg3LTguMjgsMy4yLTE2LjY1LC43My04LjM3LTIuNDctMTQuNDgtNi44LTEzLjY2LTkuNjcsLjgzLTIuODcsOC4yOC0zLjIsMTYuNjUtLjczWiIgc3R5bGU9ImZpbGw6IzFjMWMxYzsiLz48cGF0aCBkPSJNMTE2LjU0LDEwMy43NGM4Ljg4LDIuNjIsMTUuNDEsNy4wNywxNC41OSw5Ljk0LS44MywyLjg3LTguNywzLjA4LTE3LjU4LC40Ni04Ljg4LTIuNjItMTUuNDEtNy4wNy0xNC41OS05Ljk0LC44My0yLjg3LDguNy0zLjA4LDE3LjU4LS40NloiIHN0eWxlPSJmaWxsOiMxYzFjMWM7Ii8+PHBhdGggZD0iTTcxLjY0LDk3LjcxYy0yLjA4LTIuMTUtOC44OCwuOTgtMTUuMiw2Ljk5LTYuMzIsNi4wMS05Ljc2LDEyLjYzLTcuNjksMTQuNzgsMi4wOCwyLjE1LDguODgtLjk4LDE1LjItNi45OSw2LjMyLTYuMDEsOS43Ni0xMi42Myw3LjY5LTE0Ljc4WiIgc3R5bGU9ImZpbGw6IzFjMWMxYzsiLz48L3N2Zz4='

export class PeraWallet extends BaseWallet {
  private client: PeraWalletConnect | null = null
  private options: PeraWalletConnectOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.PERA>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.projectId) {
      throw new Error(`[${this.metadata.name}] Missing required option: projectId`)
    }
    this.options = options
    this.store = store
  }

  static defaultMetadata = { name: 'Pera', icon }

  private async initializeClient(): Promise<PeraWalletConnect> {
    console.info(`[${this.metadata.name}] Initializing client...`)
    const module = await import('@perawallet/connect-beta')

    const PeraWalletConnect = module.PeraWalletConnect || module.default.PeraWalletConnect

    const client = new PeraWalletConnect(this.options)
    client.client?.on('session_delete', this.onDisconnect)
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
