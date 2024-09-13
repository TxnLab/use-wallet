import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  compareAccounts,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray
} from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import { WalletId, type WalletAccount, type WalletConstructor } from 'src/wallets/types'
import type AVMWebProviderSDK from '@agoralabs-sh/avm-web-provider'

export function isAVMWebProviderSDKError(error: any): error is AVMWebProviderSDK.BaseARC0027Error {
  return typeof error === 'object' && 'code' in error && 'message' in error
}

export abstract class AVMProvider extends BaseWallet {
  public avmWebClient: AVMWebProviderSDK.AVMWebClient | null = null
  protected avmWebProviderSDK: typeof AVMWebProviderSDK | null = null
  protected providerId: string

  constructor(args: WalletConstructor<WalletId> & { providerId: string }) {
    super(args)
    this.providerId = args.providerId
  }

  protected async _initializeAVMWebProviderSDK(): Promise<typeof AVMWebProviderSDK> {
    if (!this.avmWebProviderSDK) {
      console.info(`[${this.constructor.name}] Initializing @agoralabs-sh/avm-web-provider...`)

      const module = await import('@agoralabs-sh/avm-web-provider')
      this.avmWebProviderSDK = module.default ? module.default : module

      if (!this.avmWebProviderSDK) {
        throw new Error(
          'Failed to initialize, the @agoralabs-sh/avm-web-provider sdk was not provided'
        )
      }
    }

    return this.avmWebProviderSDK
  }

  protected async _initializeAVMWebClient(): Promise<AVMWebProviderSDK.AVMWebClient> {
    const avmWebProviderSDK = await this._initializeAVMWebProviderSDK()

    if (!avmWebProviderSDK.AVMWebClient) {
      throw new Error('Failed to initialize, AVMWebClient not found')
    }

    if (!this.avmWebClient) {
      console.info(`[${this.constructor.name}] Initializing new client...`)
      this.avmWebClient = avmWebProviderSDK.AVMWebClient.init()
    }

    return this.avmWebClient
  }

  protected async _getGenesisHash(): Promise<string> {
    const algodClient = this.getAlgodClient()
    const version = await algodClient.versionsCheck().do()
    return version.genesis_hash_b64
  }

  protected _mapAVMWebProviderAccountToWalletAccounts(
    accounts: AVMWebProviderSDK.IAccount[]
  ): WalletAccount[] {
    return accounts.map(({ address, name }, idx) => ({
      name: name || `[${this.metadata.name}] Account ${idx + 1}`,
      address
    }))
  }

  protected processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): AVMWebProviderSDK.IARC0001Transaction[] {
    const txnsToSign: AVMWebProviderSDK.IARC0001Transaction[] = []

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

  protected processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): AVMWebProviderSDK.IARC0001Transaction[] {
    const txnsToSign: AVMWebProviderSDK.IARC0001Transaction[] = []

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

  /**
   * Abstract methods
   * These methods must be implemented by specific wallet providers
   */
  protected abstract _enable(): Promise<AVMWebProviderSDK.IEnableResult>
  protected abstract _disable(): Promise<AVMWebProviderSDK.IDisableResult>
  protected abstract _signTransactions(
    txns: AVMWebProviderSDK.IARC0001Transaction[]
  ): Promise<AVMWebProviderSDK.ISignTransactionsResult>

  /**
   * Common methods
   * These methods can be overridden by specific wallet providers if needed
   */
  public async connect(): Promise<WalletAccount[]> {
    try {
      console.info(`[${this.metadata.name}] Connecting...`)

      const result = await this._enable()

      console.info(
        `[${this.metadata.name}] Successfully connected on network "${result.genesisId}"`
      )

      const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)

      const walletState: WalletState = {
        accounts: walletAccounts,
        activeAccount: walletAccounts[0]
      }

      addWallet(this.store, {
        walletId: this.id,
        wallet: walletState
      })

      console.info(`[${this.metadata.name}] ✅ Connected.`, walletState)
      return walletAccounts
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] Error connecting: ` +
          (isAVMWebProviderSDKError(error)
            ? `${error.message} (code: ${error.code})`
            : error.message)
      )
      throw error
    }
  }

  public async disconnect(): Promise<void> {
    try {
      console.info(`[${this.metadata.name}] Disconnecting...`)
      this.onDisconnect()

      const result = await this._disable()

      console.info(
        `[${this.metadata.name}] Successfully disconnected${result.sessionIds && result.sessionIds.length ? ` sessions [${result.sessionIds.join(',')}]` : ''} on network "${result.genesisId}"`
      )
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] Error disconnecting: ` +
          (isAVMWebProviderSDKError(error)
            ? `${error.message} (code: ${error.code})`
            : error.message)
      )
      throw error
    }
  }

  public async resumeSession(): Promise<void> {
    const state = this.store.state
    const walletState = state.wallets[this.id]

    if (!walletState) {
      return
    }

    try {
      console.info(`[${this.metadata.name}] Resuming session...`)

      const result = await this._enable()

      if (result.accounts.length === 0) {
        throw new Error(`No accounts found!`)
      }

      const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)
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
      console.error(
        `[${this.metadata.name}] Error resuming session: ` +
          (isAVMWebProviderSDKError(error)
            ? `${error.message} (code: ${error.code})`
            : error.message)
      )
      this.onDisconnect()
      throw error
    }
  }

  public async signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    try {
      let txnsToSign: AVMWebProviderSDK.IARC0001Transaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      // Sign transactions
      const signTxnsResult = await this._signTransactions(txnsToSign)

      // Convert base64 to Uint8Array
      return signTxnsResult.stxns.map((value) => {
        if (value === null) {
          return null
        }
        return base64ToByteArray(value)
      })
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] Error signing transactions: ` +
          (isAVMWebProviderSDKError(error)
            ? `${error.message} (code: ${error.code})`
            : error.message)
      )
      throw error
    }
  }
}
