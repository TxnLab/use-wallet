import { Buffer } from 'buffer'
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import {
  ARC_0027_CHANNEL_NAME,
  ARC_0027_ENABLE_REQUEST,
  ARC_0027_GET_PROVIDERS_REQUEST,
  ARC_0027_PROVIDER_ID,
  ARC_0027_SIGN_TXNS_REQUEST,
  DEFAULT_REQUEST_TIMEOUT,
  ICON,
  LOWER_REQUEST_TIMEOUT,
  METHOD_NOT_SUPPORTED_ERROR,
  METHOD_TIMED_OUT_ERROR,
  NETWORK_NOT_SUPPORTED_ERROR,
  UNKNOWN_ERROR
} from './constants'
import type { InitParams, Network, Wallet } from '../../types'
import type {
  Arc0001SignTxns,
  Arc0027Account,
  EnableParams,
  EnableResult,
  GetProvidersParams,
  GetProvidersResult,
  KibisisClientConstructor,
  ProviderMethods,
  RequestMessage,
  ResponseError,
  ResponseMessage,
  SendRequestWithTimeoutOptions,
  SignTxnsParams,
  SignTxnsResult
} from './types'
import { DecodedSignedTransaction, DecodedTransaction } from '../../types'
import { generateUuid } from './utils'

class KibisisClient extends BaseClient {
  genesisHash: string
  methods: ProviderMethods[]
  network: Network

  constructor({
    metadata,
    algosdk,
    algodClient,
    genesisHash,
    methods,
    network
  }: KibisisClientConstructor) {
    super(metadata, algosdk, algodClient)

    this.genesisHash = genesisHash
    this.methods = methods
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

  static async init({
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.KIBISIS>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${KibisisClient.init.name}: initializing...`)

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const version = await algodClient.versionsCheck().do()
      const genesisHash = version['genesis_hash_b64'] // get the genesis hash of the network
      const result = await KibisisClient.sendRequestWithTimeout<
        GetProvidersParams,
        GetProvidersResult
      >({
        method: 'getProviders',
        params: {
          providerId: ARC_0027_PROVIDER_ID
        },
        reference: ARC_0027_GET_PROVIDERS_REQUEST,
        timeout: LOWER_REQUEST_TIMEOUT
      })

      // check for a result
      if (!result) {
        throw {
          code: UNKNOWN_ERROR,
          message: `received response, but provider details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: ARC_0027_PROVIDER_ID
        } as ResponseError
      }

      const networkConfiguration = result.networks.find(
        (value) => value.genesisHash === genesisHash
      )

      // check if the network is supported
      if (!networkConfiguration) {
        throw {
          code: NETWORK_NOT_SUPPORTED_ERROR,
          data: {
            genesisHash
          },
          message: `network "${network}" not supported on provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: ARC_0027_PROVIDER_ID
        } as ResponseError<{ genesisHash: string }>
      }

      const provider = new KibisisClient({
        metadata: KibisisClient.metadata,
        algosdk: algosdk,
        algodClient: algodClient,
        genesisHash,
        methods: networkConfiguration.methods,
        network
      })

      debugLog(`${PROVIDER_ID.KIBISIS.toUpperCase()}#${KibisisClient.init.name}: initialized`, '✅')

      return provider
    } catch (error) {
      console.error('Error initializing...', error)
      return null
    }
  }

  static mapAccountsToWallet(accounts: Arc0027Account[]): Wallet {
    return {
      ...KibisisClient.metadata,
      accounts: accounts.map(({ address, name }) => ({
        address,
        name: name || '',
        providerId: PROVIDER_ID.KIBISIS
      }))
    }
  }

  static async sendRequestWithTimeout<Params, Result>({
    method,
    params,
    timeout,
    reference
  }: SendRequestWithTimeoutOptions<Params>): Promise<Result | undefined> {
    return new Promise<Result | undefined>((resolve, reject) => {
      const channel = new BroadcastChannel(ARC_0027_CHANNEL_NAME)
      const requestId = generateUuid()
      // eslint-disable-next-line prefer-const
      let timer: number

      // listen to responses
      channel.onmessage = (message: MessageEvent<ResponseMessage<Result>>) => {
        // if the response's request id does not match the intended request, just ignore
        if (!message.data || message.data.requestId !== requestId) {
          return
        }

        // clear the timer, we can handle it from here
        window.clearTimeout(timer)

        // if there is an error, reject
        if (message.data.error) {
          reject(message.data.error)

          // close the channel, we are done here
          return channel.close()
        }

        // return the result
        resolve(message.data.result)

        // close the channel, we are done here
        return channel.close()
      }

      timer = window.setTimeout(() => {
        // close the channel connection
        channel.close()

        reject({
          code: METHOD_TIMED_OUT_ERROR,
          data: {
            method
          },
          message: `no response from provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
          providerId: ARC_0027_PROVIDER_ID
        } as ResponseError<{ method: ProviderMethods }>)
      }, timeout || DEFAULT_REQUEST_TIMEOUT)

      // broadcast the request
      channel.postMessage({
        id: requestId,
        params,
        reference
      } as RequestMessage<Params>)
    })
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
   * Calls the enable method on the provider that returns the authorized accounts.
   * @returns {Arc0027Account[]} the authorized accounts.
   * @throws {METHOD_CANCELED_ERROR} if the method was cancelled by the user.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async enable(): Promise<Arc0027Account[]> {
    const method = 'enable'

    debugLog(
      `${PROVIDER_ID.KIBISIS.toUpperCase()}#${
        this.refreshSupportedMethods.name
      }(): check if "${method}" is supported on "${this.network}"`
    )

    // check the method is supported
    this.validateMethod(method)

    const result = await KibisisClient.sendRequestWithTimeout<EnableParams, EnableResult>({
      method,
      params: {
        genesisHash: this.genesisHash,
        providerId: ARC_0027_PROVIDER_ID
      },
      reference: ARC_0027_ENABLE_REQUEST
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `received response, but "${method}" request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    return result.accounts
  }

  /**
   * Convenience function that gets the provider information and updates the supported methods. This should be called
   * before interacting with the provider to ensure methods are supported.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async refreshSupportedMethods(): Promise<void> {
    const method = 'getProviders'

    debugLog(
      `${PROVIDER_ID.KIBISIS.toUpperCase()}#${
        this.refreshSupportedMethods.name
      }(): refreshing supported methods`
    )

    const result = await KibisisClient.sendRequestWithTimeout<
      GetProvidersParams,
      GetProvidersResult
    >({
      method,
      params: {
        providerId: ARC_0027_PROVIDER_ID
      },
      reference: ARC_0027_GET_PROVIDERS_REQUEST,
      timeout: LOWER_REQUEST_TIMEOUT
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `received response, but enable request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    const networkConfiguration = result.networks.find(
      (value) => value.genesisHash === this.genesisHash
    )

    // check if the network is supported
    if (!networkConfiguration) {
      throw {
        code: NETWORK_NOT_SUPPORTED_ERROR,
        data: {
          genesisHash: this.genesisHash
        },
        message: `network "${
          this.network
        }" not supported on provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError<{ genesisHash: string }>
    }

    debugLog(
      `${PROVIDER_ID.KIBISIS.toUpperCase()}#${
        this.refreshSupportedMethods.name
      }(): methods [${networkConfiguration.methods.join(',')}] found for "${this.network}"`
    )

    // update the methods
    this.methods = networkConfiguration.methods
  }

  /**
   * Calls the signTxns methods to sign the supplied transactions.
   * @param {Arc0001SignTxns[]} txns -  the unsigned or signed transactions as defined in ARC-0001.
   * @returns {(string | null)[]} the authorized accounts.
   * @throws {INVALID_INPUT_ERROR} if computed group ID for the txns does not match the assigned group ID.
   * @throws {INVALID_GROUP_ID_ERROR} if the unsigned txns is malformed or not conforming to ARC-0001.
   * @throws {METHOD_CANCELED_ERROR} if the method was cancelled by the user.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   * @throws {METHOD_TIMED_OUT_ERROR} if the method timed out by lack of response.
   * @throws {NETWORK_NOT_SUPPORTED_ERROR} if the network is not supported for the configured network.
   * @throws {UNAUTHORIZED_SIGNER_ERROR} if a signer in the request is not authorized by the provider.
   * @throws {UNKNOWN_ERROR} if the response result was empty.
   */
  private async signTxns(txns: Arc0001SignTxns[]): Promise<(string | null)[]> {
    const method = 'signTxns'

    debugLog(
      `${PROVIDER_ID.KIBISIS.toUpperCase()}#${
        this.signTransactions.name
      }(): check if "${method}" is supported on "${this.network}"`
    )

    // check the method is supported
    this.validateMethod(method)

    const result = await KibisisClient.sendRequestWithTimeout<SignTxnsParams, SignTxnsResult>({
      method,
      params: {
        providerId: ARC_0027_PROVIDER_ID,
        txns
      },
      reference: ARC_0027_SIGN_TXNS_REQUEST
    })

    // check for a result
    if (!result) {
      throw {
        code: UNKNOWN_ERROR,
        message: `received response, but "${method}" request details were empty for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError
    }

    return result.stxns
  }

  /**
   * Validates whether a method is supported with the provider.
   * @param {ProviderMethods} method -  the method to validate.
   * @throws {METHOD_NOT_SUPPORTED_ERROR} if the method is not supported for the configured network.
   */
  private validateMethod(method: ProviderMethods): void {
    if (!this.methods.includes(method)) {
      throw {
        code: METHOD_NOT_SUPPORTED_ERROR,
        data: {
          method
        },
        message: `"${method}" operation not supported on "${
          this.network
        }" for provider "${PROVIDER_ID.KIBISIS.toUpperCase()}"`,
        providerId: ARC_0027_PROVIDER_ID
      } as ResponseError<{ method: string }>
    }
  }

  /**
   * public functions
   */

  async connect(): Promise<Wallet> {
    await this.refreshSupportedMethods() // refresh the supported methods

    const accounts: Arc0027Account[] = await this.enable()

    return KibisisClient.mapAccountsToWallet(accounts)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect(): Promise<void> {
    return
  }

  async reconnect(): Promise<Wallet | null> {
    return await this.connect()
  }

  async signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> {
    await this.refreshSupportedMethods() // refresh the supported methods

    const txns: Arc0001SignTxns[] = await Promise.all(
      transactions.map<Promise<Arc0001SignTxns>>(async (value, index) => {
        const decodedTxn = this.algosdk.decodeObj(value) as
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
          this.algosdk.decodeUnsignedTransaction(value).toByte()
        )

        // if the transaction is signed, instruct the provider not to sign by providing an empty signers array
        if (isSigned) {
          return {
            txn: this.convertBytesToBase64(
              this.algosdk.decodeSignedTransaction(value).txn.toByte()
            ),
            signers: [],
            ...(authAddr && { authAddr })
          }
        }

        // if the sender is not authorized or the index has not been included in the to be signed indexes, instruct the provider not to sign by providing an empty signers array
        if (
          !connectedAccounts.includes(sender) ||
          (indexesToSign && !indexesToSign.includes(index))
        ) {
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
      })
    )
    const result = await this.signTxns(txns)

    // null values indicate transactions that were not signed by the provider, as defined in ARC-0001, see https://arc.algorand.foundation/ARCs/arc-0001#semantic-and-security-requirements
    return result.reduce<Uint8Array[]>((acc, value, index) => {
      if (value) {
        return [...acc, this.convertBase64ToBytes(value)]
      }

      // if the group wants to be returned, get the transaction from the input
      return returnGroup ? [...acc, transactions[index]] : acc
    }, [])
  }
}

export default KibisisClient
