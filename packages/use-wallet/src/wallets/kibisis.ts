import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
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
import type { Store } from '@tanstack/store'

export function isAVMWebProviderSDKError(error: any): error is AVMWebProviderSDK.BaseARC0027Error {
  return typeof error === 'object' && 'code' in error && 'message' in error
}

export const KIBISIS_AVM_WEB_PROVIDER_ID = 'f6d1c86b-4493-42fb-b88d-a62407b4cdf6'

export const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#801C96" width="480" height="480" />
  <path fill="#FFFFFF" d="M393.5,223.2c0-7.3-0.6-14.6-1.6-21.6c-0.9-6.5-2.3-12.8-4-18.9c-18-64.9-77.4-112.5-148-112.5c-70.6,0-130,47.6-148,112.5c-1.7,6.2-3,12.5-4,19c-1,7.1-1.6,14.3-1.6,21.6h0v85.5h19.7v-85.5c0-7.2,0.6-14.4,1.8-21.4c14,1.1,27.6,4.3,40.5,9.5c15.9,6.4,30.3,15.6,42.6,27.3c12.3,11.7,22,25.4,28.7,40.6c6.9,15.6,10.5,32.2,10.5,49.2v81.4h0.1h19.6h0.1v-81.5c0.1-17.1,3.6-33.7,10.5-49.2c6.7-15.2,16.4-28.8,28.7-40.6c4.2-4,8.6-7.7,13.2-11.1v132.2h19.7V223.2h0c0-2.5-0.1-5-0.4-7.4c3.3-1.6,6.6-3.1,10-4.5c12.9-5.2,26.4-8.4,40.4-9.5c1.2,7,1.7,14.2,1.8,21.4v85.5h19.7L393.5,223.2L393.5,223.2z M240.1,277.3c-11.6-29.3-32.7-54.1-59.8-71c2.9-10,8.2-19.1,15.8-26.6c11.8-11.8,27.4-18.2,44-18.2s32.3,6.5,44,18.2c4.1,4.1,7.5,8.7,10.3,13.6c5.6-3.4,11.4-6.4,17.4-9.2c-14-25.2-40.9-42.3-71.8-42.3c-35.9,0-66.3,23-77.5,55.1c-15.5-7.1-32.5-11.8-50.4-13.5c1.3-4,2.7-7.9,4.3-11.8c6.7-15.9,16.4-30.3,28.7-42.6s26.6-22,42.6-28.7c16.5-7,34-10.5,52.1-10.5s35.6,3.5,52.1,10.5c15.9,6.7,30.3,16.4,42.6,28.7s22,26.6,28.7,42.6c1.6,3.9,3.1,7.8,4.3,11.8C309,189.2,260.1,226.5,240.1,277.3z" />
  <path fill="#FFFFFF" d="M158.1,359.8h19.7V245.5c-6.1-5.4-12.7-10-19.7-14V359.8z" />
</svg>
`)}`

export class KibisisWallet extends BaseWallet {
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
   * @returns {Promise<AVMWebProviderSDK.IDisableResult>} a promise that resolves to the result.
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

        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.Disable,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID
          })
        )
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
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: KIBISIS_AVM_WEB_PROVIDER_ID
            })
          )
        }

        this.logger.debug('Disable successful', { result })
        return resolve(result)
      })

      this.logger.debug('Sending disable request...', { genesisHash })
      avmWebClient.disable({
        genesisHash,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID
      })
    })
  }

  /**
   * Calls the "enable" method on the provider. This method will timeout after 3 minutes.
   * @returns {Promise<AVMWebProviderSDK.IEnableResult>} a promise that resolves to the result.
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

        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.Enable,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID
          })
        )
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
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: KIBISIS_AVM_WEB_PROVIDER_ID
            })
          )
        }

        this.logger.debug('Enable successful', { result })
        return resolve(result)
      })

      this.logger.debug('Sending enable request...', { genesisHash })
      avmWebClient.enable({
        genesisHash,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID
      })
    })
  }

  private async _getGenesisHash(): Promise<string> {
    const algodClient = this.getAlgodClient()
    const version = await algodClient.versionsCheck().do()

    return version.genesis_hash_b64
  }

  private async _initializeAVMWebClient(): Promise<AVMWebProviderSDK.AVMWebClient> {
    const avmWebProviderSDK = this.avmWebProviderSDK || (await this._initializeAVMWebProviderSDK())

    if (!this.avmWebClient) {
      this.logger.info('Initializing new AVM Web Client...')
      this.avmWebClient = avmWebProviderSDK.AVMWebClient.init()
      this.logger.info('AVM Web Client initialized')
    }

    return this.avmWebClient
  }

  private async _initializeAVMWebProviderSDK(): Promise<typeof AVMWebProviderSDK> {
    if (!this.avmWebProviderSDK) {
      this.logger.info('Initializing @agoralabs-sh/avm-web-provider...')
      const module = await import('@agoralabs-sh/avm-web-provider')
      this.avmWebProviderSDK = module.default ? module.default : module

      if (!this.avmWebProviderSDK) {
        throw new Error(
          'Failed to initialize, the @agoralabs-sh/avm-web-provider SDK was not provided'
        )
      }

      if (!this.avmWebProviderSDK.AVMWebClient) {
        throw new Error(
          'Failed to initialize, AVMWebClient missing from @agoralabs-sh/avm-web-provider SDK'
        )
      }
      this.logger.info('@agoralabs-sh/avm-web-provider initialized')
    }

    return this.avmWebProviderSDK
  }

  private _mapAVMWebProviderAccountToWalletAccounts(
    accounts: AVMWebProviderSDK.IAccount[]
  ): WalletAccount[] {
    return accounts.map(({ address, name }, idx) => ({
      name: name || `[${this.metadata.name}] Account ${idx + 1}`,
      address
    }))
  }

  /**
   * Calls the "signTransactions" method to sign the supplied ARC-0001 transactions. This method will timeout after 3
   * minutes.
   * @returns {Promise<AVMWebProviderSDK.ISignTransactionsResult>} a promise that resolves to the result.
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
  private async _signTransactions(
    txns: AVMWebProviderSDK.IARC0001Transaction[]
  ): Promise<AVMWebProviderSDK.ISignTransactionsResult> {
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

        reject(
          new ARC0027MethodTimedOutError({
            method: ARC0027MethodEnum.SignTransactions,
            message: `no response from provider "${this.metadata.name}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID
          })
        )
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
          return reject(
            new ARC0027UnknownError({
              message: `received response, but "${method}" request details were empty for provider "${this.metadata.name}"`,
              providerId: KIBISIS_AVM_WEB_PROVIDER_ID
            })
          )
        }

        this.logger.debug('Sign transactions successful', { result })
        return resolve(result)
      })

      this.logger.debug('Sending sign transactions request...', { txns })
      avmWebClient.signTransactions({
        txns,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID
      })
    })
  }

  /**
   * public functions
   */

  public async connect(): Promise<WalletAccount[]> {
    let result: AVMWebProviderSDK.IEnableResult

    try {
      this.logger.info('Connecting...')
      result = await this._enable()
      this.logger.info(`Successfully connected on network "${result.genesisId}"`)
    } catch (error: any) {
      this.logger.error(
        'Error connecting:',
        isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message
      )
      throw error
    }

    const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount: walletAccounts[0]
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    this.logger.info('✅ Connected.', walletState)
    return walletAccounts
  }

  public async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting...')
      this.onDisconnect()

      const result = await this._disable()

      this.logger.info(
        `Successfully disconnected${result.sessionIds && result.sessionIds.length ? ` sessions [${result.sessionIds.join(',')}]` : ''} on network "${result.genesisId}"`
      )
    } catch (error: any) {
      this.logger.error(
        'Error disconnecting:',
        isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message
      )
      throw error
    }
  }

  public async resumeSession(): Promise<void> {
    const state = this.store.state
    const walletState = state.wallets[this.id]
    let result: AVMWebProviderSDK.IEnableResult

    if (!walletState) {
      this.logger.info('No session to resume')
      return
    }

    try {
      this.logger.info('Resuming session...')

      result = await this._enable()

      if (result.accounts.length === 0) {
        throw new Error('No accounts found!')
      }

      const walletAccounts = this._mapAVMWebProviderAccountToWalletAccounts(result.accounts)
      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        this.logger.warn('Session accounts mismatch, updating accounts', {
          prev: walletState.accounts,
          current: walletAccounts
        })

        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
      this.logger.info('Session resumed successfully')
    } catch (error: any) {
      this.logger.error(
        'Error resuming session:',
        isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message
      )
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
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

  private processEncodedTxns(
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

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    try {
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })
      let txnsToSign: AVMWebProviderSDK.IARC0001Transaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      this.logger.debug('Sending processed transactions to wallet...', txnsToSign)

      // Sign transactions
      const signTxnsResult = await this._signTransactions(txnsToSign)
      this.logger.debug('Received signed transactions from wallet', signTxnsResult)

      // Convert base64 to Uint8Array
      const result = signTxnsResult.stxns.map((value) => {
        if (value === null) {
          return null
        }
        return base64ToByteArray(value)
      })

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error(
        'Error signing transactions:',
        isAVMWebProviderSDKError(error) ? `${error.message} (code: ${error.code})` : error.message
      )
      throw error
    }
  }
}
