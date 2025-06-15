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

export interface W3WalletProvider {
  isConnected: () => Promise<boolean>
  account: () => Promise<WalletAccount>
  signTxns: (transactions: WalletTransaction[]) => Promise<(string | null)[]>
}

type WindowExtended = { algorand: W3WalletProvider } & Window & typeof globalThis

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg width="860" height="860" viewBox="0 0 860 860" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="860" height="860" rx="30" fill="#151923"/>
  <path d="M766 207L496.627 623.406C463.521 675.336 382.014 652.248 382.014 590.941V432.568L260.638 623.28C227.559 675.255 146 652.186 146 590.854V274.844H234.646V499.761L356.022 309.049C389.101 257.074 470.66 280.143 470.66 341.475V499.978L660.146 207L766 207Z" fill="#4BB7D1"/>
</svg>
`)}`

export class W3Wallet extends BaseWallet {
  private client: W3WalletProvider | null = null
  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    metadata = {}
  }: WalletConstructor<WalletId.W3_WALLET>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.store = store
  }

  static defaultMetadata = {
    name: 'W3 Wallet',
    icon: ICON
  }

  private async initializeClient(): Promise<W3WalletProvider> {
    this.logger.info('Initializing client...')
    if (typeof window === 'undefined' || (window as WindowExtended).algorand === undefined) {
      this.logger.error('W3 Wallet is not available.')
      throw new Error('W3 Wallet is not available.')
    }
    const client = (window as WindowExtended).algorand
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const client = this.client || (await this.initializeClient())

    const activeAccount = await client.account()

    const walletState: WalletState = {
      accounts: [activeAccount],
      activeAccount
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    this.logger.info('✅ Connected.', walletState)
    return [activeAccount]
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
      const isConnected = await client.isConnected();

      if (!isConnected) {
        this.logger.error('W3 Wallet is not connected.')
        throw new Error('W3 Wallet is not connected.')
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
