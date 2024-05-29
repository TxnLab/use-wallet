import type AVMWebProviderSDK from '@agoralabs-sh/avm-web-provider'
import type { Store } from '@tanstack/store'
import algosdk from 'algosdk'

// constants
import {
  ICON,
  KIBISIS_AVM_WEB_PROVIDER_ID,
} from './constants'

// store
import { addWallet, setAccounts, type State } from 'src/store'

// types
import { WalletId, type WalletAccount, type WalletConstructor } from 'src/wallets/types'

// utils
import { isAVMWebProviderSDKError } from './utils'
import {
  base64ToByteArray,
  byteArrayToBase64,
  compareAccounts,
  isSignedTxnObject,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'

// wallets
import { BaseWallet } from 'src/wallets/base'

export default class KibisisWallet extends BaseWallet {
  public avmWebClient: AVMWebProviderSDK.AVMWebClient | null = null
  protected avmWebProviderSDK: typeof AVMWebProviderSDK | null = null
  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    metadata = {}
  }: WalletConstructor<WalletId.KIBISIS>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    this.store = store
  }

  static defaultMetadata = {
    name: 'Kibisis',
    icon: ICON
  }

  /**
   * private functions
   */

  /**
   * Calls the "disable" method on the provider. This method will timeout after 0.75 seconds.
   * @returns {Promise<IDisableResult>} a promise that resolves to the result.
   * @private
   * @throws {MethodNotSupportedError} if the method is not supported for the configured network.
   * @throws {MethodTimedOutError} if the method timed out by lack of response (>= 3 minutes).
   * @throws {NetworkNotSupportedError} if the network is not supported for the configured network.
   * @throws {UnknownError} if the response result is empty.
   */
  private async _disable(): Promise<AVMWebProviderSDK.IDisableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      LOWER_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK || (await this._initializeAVMWebProviderSDK())
    const avmWebClient = this.avmWebClient || (await this._initializeAVMWebClient())
    const genesisHash = await this._getGenesisHash()

    return new Promise<AVMWebProviderSDK.IDisableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.Disable,
          message: `no response from provider "${this.metadata.name}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, LOWER_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onDisable(({ error, method, result }) => {
        // remove the listener, it is not needed
        avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      avmWebClient.disable({
        genesisHash,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
      })
    })
  }

  /**
   * Calls the "enable" method on the provider. This method will timeout after 3 minutes.
   * @returns {Promise<IEnableResult>} a promise that resolves to the result.
   * @private
   * @throws {MethodCanceledError} if the method was cancelled by the user.
   * @throws {MethodNotSupportedError} if the method is not supported for the configured network.
   * @throws {MethodTimedOutError} if the method timed out by lack of response (>= 3 minutes).
   * @throws {NetworkNotSupportedError} if the network is not supported for the configured network.
   * @throws {UnknownError} if the response result is empty.
   */
  private async _enable(): Promise<AVMWebProviderSDK.IEnableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK || (await this._initializeAVMWebProviderSDK())
    const avmWebClient = this.avmWebClient || (await this._initializeAVMWebClient())
    const genesisHash = await this._getGenesisHash()

    return new Promise<AVMWebProviderSDK.IEnableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.Enable,
          message: `no response from provider "${this.metadata.name}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onEnable(({ error, method, result }) => {
        // remove the listener, it is not needed
        avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      avmWebClient.enable({
        genesisHash,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
      })
    })
  }

  private async _getGenesisHash(): Promise<string> {
    const algodClient = this.getAlgodClient()
    const version = await algodClient.versionsCheck().do()

    return version.genesis_hash_b64
  }

  private async _initializeAVMWebClient(): Promise<AVMWebProviderSDK.AVMWebClient> {
    const _functionName = '_initializeAVMWebClient'
    const avmWebProviderSDK = this.avmWebProviderSDK || (await this._initializeAVMWebProviderSDK())

    if (!this.avmWebClient) {
      console.info(`[${KibisisWallet.name}]#${_functionName}: initializing new client...`)

      this.avmWebClient = avmWebProviderSDK.AVMWebClient.init()
    }

    return this.avmWebClient
  }

  private async _initializeAVMWebProviderSDK(): Promise<typeof AVMWebProviderSDK> {
    const _functionName = '_initializeAVMWebProviderSDK'

    if (!this.avmWebProviderSDK) {
      console.info(`[${KibisisWallet.name}]#${_functionName}: initializing @agoralabs-sh/avm-web-provider...`)

      this.avmWebProviderSDK = await import('@agoralabs-sh/avm-web-provider')

      if (!this.avmWebProviderSDK) {
        throw new Error('failed to initialize, the @agoralabs-sh/avm-web-provider sdk was not provided')
      }
    }

    return this.avmWebProviderSDK
  }

  private _mapAVMWebProviderAccountToWalletAccounts(accounts: AVMWebProviderSDK.IAccount[]): WalletAccount[] {
    return accounts.map(({ address, name }, idx) => ({
      name: name || `Kibisis Wallet ${idx + 1}`,
      address
    }))
  }

  /**
   * Calls the "signTransactions" method to sign the supplied ARC-0001 transactions. This method will timeout after 3
   * minutes.
   * @returns {Promise<ISignTransactionsResult>} a promise that resolves to the result.
   * @private
   * @throws {InvalidInputError} if computed group ID for the txns does not match the assigned group ID.
   * @throws {InvalidGroupIdError} if the unsigned txns is malformed or not conforming to ARC-0001.
   * @throws {MethodCanceledError} if the method was cancelled by the user.
   * @throws {MethodNotSupportedError} if the method is not supported for the configured network.
   * @throws {MethodTimedOutError} if the method timed out by lack of response (>= 3 minutes).
   * @throws {NetworkNotSupportedError} if the network is not supported for the configured network.
   * @throws {UnauthorizedSignerError} if a signer in the request is not authorized by the provider.
   * @throws {UnknownError} if the response result is empty.
   */
  private async _signTransactions(txns: AVMWebProviderSDK.IARC0001Transaction[]): Promise<AVMWebProviderSDK.ISignTransactionsResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK || (await this._initializeAVMWebProviderSDK())
    const avmWebClient = this.avmWebClient || (await this._initializeAVMWebClient())

    return new Promise<AVMWebProviderSDK.ISignTransactionsResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.SignTransactions,
          message: `no response from provider "${this.metadata.name}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = avmWebClient.onSignTransactions(({ error, method, result }) => {
        // remove the listener, it is not needed
        avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      avmWebClient.signTransactions({
        txns,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
      })
    })
  }

  /**
   * public functions
   */

  public async connect(): Promise<WalletAccount[]> {
    let result: AVMWebProviderSDK.IEnableResult

    try {
      console.info(`[${this.metadata.name}] connecting...`)

      result = await this._enable()

      console.info(`[${this.metadata.name}] successfully connected on network "${result.genesisId}"`)
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] error connecting: ` +
        (isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      return []
    }

    const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)

    addWallet(this.store, {
      walletId: this.id,
      wallet: {
        accounts: walletAccounts,
        activeAccount: walletAccounts[0]
      }
    })

    return walletAccounts
  }

  public async disconnect(): Promise<void> {
    let result: AVMWebProviderSDK.IDisableResult

    try {
      console.info(`[${this.metadata.name}] disconnecting...`)

      result = await this._disable()

      console.info(`[${this.metadata.name}] successfully disconnected${result.sessionIds && result.sessionIds.length ? ` sessions [${result.sessionIds.join(',')}]` : ''} on network "${result.genesisId}"`)
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] error disconnecting: ` +
        (isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
    }

    this.onDisconnect()
  }

  public async resumeSession(): Promise<void> {
    const state = this.store.state
    const walletState = state.wallets[this.id]
    let result: AVMWebProviderSDK.IEnableResult

    if (!walletState) {
      return
    }

    try {
      console.info(`[${this.metadata.name}] resuming session...`)

      result = await this._enable()

      if (result.accounts.length === 0) {
        throw new Error(`[${this.metadata.name}] no accounts found!`)
      }

      const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)
      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        console.warn(`[${this.metadata.name}] session accounts mismatch, updating accounts`)

        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] error resuming session: ` +
        (isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      this.onDisconnect()
    }
  }

  public async signTransactions(
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> {
    try {
      const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)
      const signedIndexes: number[] = []
      const txnsToSign: AVMWebProviderSDK.IARC0001Transaction[] = []
      // Decode transactions to access properties
      const decodedObjects = msgpackTxnGroup.map((txn) => {
        return algosdk.decodeObj(txn)
      }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

      // Marshal transactions into `AVMWebProviderSDK.IARC0001Transaction[]`
      decodedObjects.forEach((txnObject, idx) => {
        const isSigned = isSignedTxnObject(txnObject)
        const shouldSign = shouldSignTxnObject(txnObject, this.addresses, indexesToSign, idx)

        const txnBuffer: Uint8Array = msgpackTxnGroup[idx]
        const txn: algosdk.Transaction = isSigned
          ? algosdk.decodeSignedTransaction(txnBuffer).txn
          : algosdk.decodeUnsignedTransaction(txnBuffer)

        const txnBase64 = byteArrayToBase64(txn.toByte())

        if (shouldSign) {
          txnsToSign.push({ txn: txnBase64 })
          signedIndexes.push(idx)
        } else {
          txnsToSign.push({ txn: txnBase64, signers: [] })
        }
      })

      const result = await this._signTransactions(txnsToSign)

      // Filter out null results
      const signedTxnsBase64 = result.stxns.filter(Boolean) as string[]

      // Convert base64 signed transactions to msgpack
      const signedTxns = signedTxnsBase64.map((txn) => base64ToByteArray(txn))

      // Merge signed transactions back into original group
      return mergeSignedTxnsWithGroup(
        signedTxns,
        msgpackTxnGroup,
        signedIndexes,
        returnGroup
      )
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] error signing transactions: ` +
        (isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      throw error
    }
  }

  public async transactionSigner(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> {
    try {
      const txnsToSign = txnGroup.reduce<AVMWebProviderSDK.IARC0001Transaction[]>((acc, txn, idx) => {
        const txnBase64 = byteArrayToBase64(txn.toByte())

        if (indexesToSign.includes(idx)) {
          acc.push({ txn: txnBase64 })
        } else {
          acc.push({ txn: txnBase64, signers: [] })
        }
        return acc
      }, [])

      const result = await this._signTransactions(txnsToSign)
      const signedTxnsBase64 = result.stxns.filter(Boolean) as string[]

      return signedTxnsBase64.map((txn) => base64ToByteArray(txn))
    } catch (error: any) {
      console.error(
        `[${this.metadata.name}] error signing transactions: ` +
        (isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message)
      )
      throw error
    }
  }
}
