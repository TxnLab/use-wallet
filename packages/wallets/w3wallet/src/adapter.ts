import algosdk from 'algosdk'
import {
  BaseWallet,
  base64ToByteArray,
  byteArrayToBase64,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type WalletAccount,
  type WalletMetadata,
  type WalletState,
  type WalletTransaction
} from '@txnlab/use-wallet/adapter'

export interface W3WalletProvider {
  isConnected: () => Promise<boolean>
  account: () => Promise<WalletAccount>
  signTxns: (transactions: WalletTransaction[]) => Promise<(string | null)[]>
}

type WindowExtended = { w3walletAlgorand: W3WalletProvider } & Window & typeof globalThis

import { icon } from './icon'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

export class W3WalletAdapter extends BaseWallet {
  private client: W3WalletProvider | null = null

  constructor(params: AdapterConstructorParams) {
    super(params)
  }

  static defaultMetadata: WalletMetadata = {
    name: 'W3 Wallet',
    icon: ICON
  }

  private async initializeClient(): Promise<W3WalletProvider> {
    this.logger.info('Initializing client...')
    if (
      typeof window === 'undefined' ||
      (window as WindowExtended).w3walletAlgorand === undefined
    ) {
      this.logger.error('W3 Wallet is not available.')
      throw new Error('W3 Wallet is not available.')
    }
    const client = (window as WindowExtended).w3walletAlgorand
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

    this.store.addWallet(walletState)

    this.logger.info('Connected successfully', walletState)
    return [activeAccount]
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
      const client = await this.initializeClient()
      const isConnected = await client.isConnected()

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
