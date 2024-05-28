import type AVMWebProviderSDK from '@agoralabs-sh/avm-web-provider'
import type {
  IAccount as IARC0027Account,
  IARC0001Transaction,
  IDisableResult,
  IEnableResult,
  ISignTransactionsResult
} from '@agoralabs-sh/avm-web-provider'
import { Buffer } from 'buffer'
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import {
  ICON,
  KIBISIS_AVM_WEB_PROVIDER_ID,
} from './constants'
import type { InitParams, Network, Wallet } from '../../types'
import type { DecodedSignedTransaction, DecodedTransaction } from '../../types'
import type { ClientConstructorOptions, RawTransactionToSign } from './types'

class KibisisClient extends BaseClient {
  avmWebClient: AVMWebProviderSDK.AVMWebClient
  avmWebProviderSDK: typeof AVMWebProviderSDK
  genesisHash: string
  network: Network

  constructor({
    avmWebClient,
    avmWebProviderSDK,
    metadata,
    algosdk,
    algodClient,
    genesisHash,
    network
  }: ClientConstructorOptions) {
    super(metadata, algosdk, algodClient)

    this.avmWebClient = avmWebClient
    this.avmWebProviderSDK = avmWebProviderSDK
    this.genesisHash = genesisHash
    this.network = network
  }

  static metadata = {
    id: PROVIDER_ID.KIBISIS,
    icon: ICON,
    isWalletConnect: false,
    name: 'Kibisis'
  }

  /**
   * public static functions
   */

  public static async init({
    algodOptions,
    algosdkStatic,
    clientStatic,
    getDynamicClient,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.KIBISIS>): Promise<BaseClient | null> {
    const _functionName = 'init'
    let avmWebProviderSDK: typeof AVMWebProviderSDK | null

    try {
      debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${_functionName}: initializing...`)

      avmWebProviderSDK = clientStatic || (getDynamicClient && await getDynamicClient()) || null

      if (!avmWebProviderSDK) {
        throw new Error('failed to initialize, the @agoralabs-sh/avm-web-provider sdk was not provided')
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const version = await algodClient.versionsCheck().do()
      const genesisHash = version['genesis_hash_b64'] // get the genesis hash of the network
      const provider = new KibisisClient({
        avmWebClient: avmWebProviderSDK.AVMWebClient.init(),
        avmWebProviderSDK,
        metadata: KibisisClient.metadata,
        algosdk: algosdk,
        algodClient: algodClient,
        genesisHash,
        network
      })

      debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${_functionName}: initialized`, '✅')

      return provider
    } catch (error) {
      console.error(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${_functionName}:`, error)
      return null
    }
  }

  /**
   * Maps account objects returned from the AVM Web Provider to the required object for UseWallet.
   * @param {IARC0027Account[]} accounts - a list of AVM Web Provider accounts.
   * @returns {Wallet} the account objects mapped to a wallet object.
   */
  public static mapAVMWebProviderAccountsToWallet(accounts: IARC0027Account[]): Wallet {
    return {
      ...KibisisClient.metadata,
      accounts: accounts.map(({ address, name }) => ({
        address,
        name: name || '',
        providerId: PROVIDER_ID.KIBISIS
      }))
    }
  }

  /**
   * private functions
   */

  private convertBytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64')
  }

  private convertBase64ToBytes(input: string): Uint8Array {
    return Buffer.from(input, 'base64')
  }

  /**
   * Calls the "disable" method on the provider. This method will timeout after 0.75 seconds.
   * @returns {Promise<IDisableResult>} a promise that resolves to the result.
   * @private
   * @throws {MethodNotSupportedError} if the method is not supported for the configured network.
   * @throws {MethodTimedOutError} if the method timed out by lack of response (>= 3 minutes).
   * @throws {NetworkNotSupportedError} if the network is not supported for the configured network.
   * @throws {UnknownError} if the response result is empty.
   */
  private async _disable(): Promise<IDisableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      LOWER_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK

    return new Promise<IDisableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        this.avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.Disable,
          message: `no response from provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, LOWER_REQUEST_TIMEOUT)
      const listenerId = this.avmWebClient.onDisable(({ error, method, result }) => {
        // remove the listener, it is not needed
        this.avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      this.avmWebClient.disable({
        genesisHash: this.genesisHash,
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
  private async _enable(): Promise<IEnableResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK

    return new Promise<IEnableResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        this.avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.Enable,
          message: `no response from provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = this.avmWebClient.onEnable(({ error, method, result }) => {
        // remove the listener, it is not needed
        this.avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      this.avmWebClient.enable({
        genesisHash: this.genesisHash,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
      })
    })
  }

  /**
   * Convenience function that concerts a raw transaction to an ARC-0001 transaction that is ready to be signed by the
   * wallet.
   * @param {Uint8Array} rawTransaction - the raw transaction to transform.
   * @param {string[]} connectedAccounts - a list of connected accounts.
   * @param {boolean} toSign - [optional] whether to sign the transaction or not.
   * @returns {Promise<IARC0001Transaction>} the transaction that is ready to be signed by the wallet.
   * @private
   */
  private async _mapRawTransactionToARC0001Transaction(
    rawTransaction: Uint8Array,
    connectedAccounts: string[],
    toSign?: boolean
  ): Promise<IARC0001Transaction> {
    const decodedTxn = this.algosdk.decodeObj(rawTransaction) as
      | DecodedTransaction
      | DecodedSignedTransaction
    const isSigned = !!(decodedTxn as DecodedSignedTransaction).txn
    const sender = this.algosdk.encodeAddress(
      isSigned
        ? (decodedTxn as DecodedSignedTransaction).txn.snd
        : (decodedTxn as DecodedTransaction).snd
    )
    const accountInfo = await this.getAccountInfo(sender)
    const authAddr = accountInfo['auth-addr']
    const txn = this.convertBytesToBase64(
      this.algosdk.decodeUnsignedTransaction(rawTransaction).toByte()
    )

    // if the transaction is signed, instruct the provider not to sign by providing an empty signers array
    if (isSigned) {
      return {
        txn: this.convertBytesToBase64(
          this.algosdk.decodeSignedTransaction(rawTransaction).txn.toByte()
        ),
        signers: [],
        ...(authAddr && { authAddr })
      }
    }

    // if the sender is not authorized or the index has not been included in the to be signed indexes, instruct the provider not to sign by providing an empty signers array
    if (!connectedAccounts.includes(sender) || !toSign) {
      return {
        txn,
        signers: [],
        ...(authAddr && { authAddr })
      }
    }

    // if the transaction is not signed, has been authorized and/or is in the index, instruct the provider not to sign
    return {
      txn,
      ...(authAddr && { authAddr })
    }
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
  private async _signTransactions(txns: IARC0001Transaction[]): Promise<ISignTransactionsResult> {
    const {
      ARC0027MethodEnum,
      ARC0027MethodTimedOutError,
      ARC0027UnknownError,
      DEFAULT_REQUEST_TIMEOUT
    } = this.avmWebProviderSDK

    return new Promise<ISignTransactionsResult>((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        // remove the listener
        this.avmWebClient.removeListener(listenerId)

        reject(new ARC0027MethodTimedOutError({
          method: ARC0027MethodEnum.SignTransactions,
          message: `no response from provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
        }))
      }, DEFAULT_REQUEST_TIMEOUT)
      const listenerId = this.avmWebClient.onSignTransactions(({ error, method, result }) => {
        // remove the listener, it is not needed
        this.avmWebClient.removeListener(listenerId)

        // remove the timeout
        window.clearTimeout(timerId)

        if (error) {
          return reject(error)
        }

        if (!result) {
          return reject(new ARC0027UnknownError({
            message: `received response, but "${method}" request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
            providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
          }))
        }

        return resolve(result)
      })

      // send the request
      this.avmWebClient.signTransactions({
        txns,
        providerId: KIBISIS_AVM_WEB_PROVIDER_ID,
      })
    })
  }

  /**
   * public functions
   */

  async connect(): Promise<Wallet> {
    const _functionName = 'connect'
    const result = await this._enable()

    debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${_functionName}: successfully connected on network "${result.genesisId}"`)

    return KibisisClient.mapAVMWebProviderAccountsToWallet(result.accounts)
  }

  async disconnect(): Promise<void> {
    const _functionName = 'disconnect'
    const result = await this._disable()

    debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${_functionName}: successfully disconnected${result.sessionIds && result.sessionIds.length ? ` sessions [${result.sessionIds.join(',')}]` : ''} on network "${result.genesisId}"`)
  }

  async reconnect(): Promise<Wallet | null> {
    return await this.connect()
  }

  async signTransactions(
    connectedAccounts: string[],
    transactionsOrTransactionGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> {
    // TODO: the below disable/ignore is necessary as the reduce function throws a TS error for union types (https://github.com/microsoft/TypeScript/issues/36390), however, these can be removed when typescript is updated to 5.2.2+, as the issue has been fixed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const flatTransactions: RawTransactionToSign[] = transactionsOrTransactionGroups.reduce(
      (acc: RawTransactionToSign[], currentValue: Uint8Array | Uint8Array[], index: number) => {
        const toSign = indexesToSign && indexesToSign.includes(index)

        // if an element is an array, concatenate each mapped element as we want a flat (one-dimensional) array to sent to the wallet
        if (Array.isArray(currentValue)) {
          return [
            ...acc,
            ...currentValue.map((value) => ({
              toSign,
              transaction: value
            }))
          ]
        }

        return [
          ...acc,
          {
            toSign,
            transaction: currentValue
          }
        ]
      },
      []
    )
    const transactions = await Promise.all(
      flatTransactions.map(({ toSign, transaction }) =>
        this._mapRawTransactionToARC0001Transaction(transaction, connectedAccounts, toSign)
      )
    )
    const result = await this._signTransactions(transactions)

    // null values indicate transactions that were not signed by the provider, as defined in ARC-0001, see https://arc.algorand.foundation/ARCs/arc-0001#semantic-and-security-requirements
    return result.stxns.reduce<Uint8Array[]>((acc, value, index) => {
      if (value) {
        return [...acc, this.convertBase64ToBytes(value)]
      }

      // if the group wants to be returned, get the unsigned transaction
      return returnGroup ? [...acc, this.convertBase64ToBytes(transactions[index].txn)] : acc
    }, [])
  }
}

export default KibisisClient
