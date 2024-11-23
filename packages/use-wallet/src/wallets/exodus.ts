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

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <linearGradient id="grad1" gradientUnits="userSpaceOnUse" x1="246.603" y1="9.2212" x2="174.158" y2="308.5426" gradientTransform="matrix(1 0 0 -1 0 302)">
    <stop offset="0" stop-color="#0B46F9" />
    <stop offset="1" stop-color="#BBFBE0" />
  </linearGradient>
  <path fill="url(#grad1)" d="M274.7,93.9L166.6,23v39.6l69.4,45.1l-8.2,25.8h-61.2v32.9h61.2l8.2,25.8l-69.4,45.1V277l108.2-70.7L257,150.1L274.7,93.9z" />
  
  <linearGradient id="grad2" gradientUnits="userSpaceOnUse" x1="129.3516" y1="-19.1573" x2="56.9066" y2="280.1641" gradientTransform="matrix(1 0 0 -1 0 302)">
    <stop offset="0" stop-color="#0B46F9" />
    <stop offset="1" stop-color="#BBFBE0" />
  </linearGradient>
  <path fill="url(#grad2)" d="M72.5,166.4h61v-32.9H72.2l-7.9-25.8l69.2-45.1V23L25.3,93.9L43,150.1l-17.7,56.2L133.7,277v-39.6l-69.4-45.1L72.5,166.4z" />
  
  <mask id="mask1" maskUnits="userSpaceOnUse" x="25.4" y="23" width="247.6" height="254">
    <path fill="url(#grad1)" d="M274.7,93.9L166.6,23v39.6l69.4,45.1l-8.2,25.8h-61.2v32.9h61.2l8.2,25.8l-69.4,45.1V277l108.2-70.7L257,150.1L274.7,93.9z" />
    <path fill="url(#grad2)" d="M72.5,166.4h61v-32.9H72.2l-7.9-25.8l69.2-45.1V23L25.3,93.9L43,150.1l-17.7,56.2L133.7,277v-39.6l-69.4-45.1L72.5,166.4z" />
  </mask>
  
  <linearGradient id="grad3" gradientUnits="userSpaceOnUse" x1="46.4662" y1="228.7554" x2="171.8638" y2="135.1039" gradientTransform="matrix(1 0 0 -1 0 302)">
    <stop offset="0.1198" stop-color="#8952FF" stop-opacity="0.87" />
    <stop offset="1" stop-color="#DABDFF" stop-opacity="0" />
  </linearGradient>
  <rect x="25.4" y="23" width="247.6" height="254" fill="url(#grad3)" mask="url(#mask1)" />
</svg>
`)}`

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
    metadata = {},
    networks
  }: WalletConstructor<WalletId.EXODUS>) {
    super({ id, metadata, getAlgodClient, store, subscribe, networks })
    this.options = options
    this.store = store
  }

  static defaultMetadata = {
    name: 'Exodus',
    icon: ICON
  }

  private async initializeClient(): Promise<Exodus> {
    this.logger.info('Initializing client...')
    if (typeof window === 'undefined' || (window as WindowExtended).algorand === undefined) {
      this.logger.error('Exodus is not available.')
      throw new Error('Exodus is not available.')
    }
    const client = (window as WindowExtended).algorand
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const client = this.client || (await this.initializeClient())
    const { accounts } = await client.enable(this.options)

    if (accounts.length === 0) {
      this.logger.error('No accounts found!')
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

    this.logger.info('✅ Connected.', walletState)
    return walletAccounts
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
      const client = await this.initializeClient()

      if (!client.isConnected) {
        this.logger.error('Exodus is not connected.')
        throw new Error('Exodus is not connected.')
      }
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
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
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
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
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
  ): Promise<(Uint8Array | null)[]> => {
    try {
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })
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

      this.logger.debug('Sending processed transactions to wallet...', txnsToSign)

      // Sign transactions
      const signTxnsResult = await client.signTxns(txnsToSign)
      this.logger.debug('Received signed transactions from wallet', signTxnsResult)

      // Convert base64 to Uint8Array
      const result = signTxnsResult.map((value) => {
        if (value === null) {
          return null
        }
        return base64ToByteArray(value)
      })

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
