/**
 * Documentation:
 * https://github.com/perawallet/connect
 */
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { ICON } from './constants'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { Wallet } from '../../types/wallet'
import type {
  PeraTransaction,
  PeraWalletClientConstructor,
  PeraWalletConnectOptions
} from './types'

class PeraWalletClient extends BaseClient {
  #client: PeraWalletConnect
  clientOptions?: PeraWalletConnectOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: PeraWalletClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.metadata = PeraWalletClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.PERA,
    name: 'Pera',
    icon: ICON,
    isWalletConnect: true
  }

  static async init({
    clientOptions,
    algodOptions,
    clientStatic,
    getDynamicClient,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.PERA>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.PERA.toUpperCase()} initializing...`)

      let PeraWalletConnect
      if (clientStatic) {
        PeraWalletConnect = clientStatic
      } else if (getDynamicClient) {
        PeraWalletConnect = await getDynamicClient()
      } else {
        throw new Error(
          'Pera Wallet provider missing required property: clientStatic or getDynamicClient'
        )
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      const peraWallet = new PeraWalletConnect({
        ...(clientOptions && clientOptions)
      })

      const provider = new PeraWalletClient({
        metadata: PeraWalletClient.metadata,
        client: peraWallet,
        clientOptions,
        algosdk,
        algodClient,
        network
      })

      debugLog(`${PROVIDER_ID.PERA.toUpperCase()} initialized`, '✅')

      return provider
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect(onDisconnect: () => void): Promise<Wallet> {
    const accounts = await this.#client.connect()

    this.#client.connector?.on('disconnect', onDisconnect)

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${PeraWalletClient.metadata.id}`)
    }

    const mappedAccounts = accounts.map((address: string, index: number) => ({
      name: `Pera Wallet ${index + 1}`,
      address,
      providerId: PeraWalletClient.metadata.id
    }))

    return {
      ...PeraWalletClient.metadata,
      accounts: mappedAccounts
    }
  }

  async reconnect(onDisconnect: () => void) {
    const accounts = await this.#client.reconnectSession().catch(console.info)

    this.#client.connector?.on('disconnect', onDisconnect)

    if (!accounts) {
      onDisconnect()
      return null
    }

    return {
      ...PeraWalletClient.metadata,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Pera Wallet ${index + 1}`,
        address,
        providerId: PeraWalletClient.metadata.id
      }))
    }
  }

  async disconnect() {
    await this.#client.disconnect()
  }

  async signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    // If txnGroups is a nested array, flatten it
    const transactions: Uint8Array[] = Array.isArray(txnGroups[0])
      ? (txnGroups as Uint8Array[][]).flatMap((txn) => txn)
      : (txnGroups as Uint8Array[])

    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<DecodedTransaction | DecodedSignedTransaction>

    const signedIndexes: number[] = []

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<PeraTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      // If the indexes to be signed is specified, designate that it should be signed
      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i])
        })
        // If the indexes to be signed is specified, but it's not included in it,
        // designate that it should not be signed
      } else if (indexesToSign && indexesToSign.length && !indexesToSign.includes(i)) {
        acc.push({
          txn: isSigned
            ? this.algosdk.decodeSignedTransaction(transactions[i]).txn
            : this.algosdk.decodeUnsignedTransaction(transactions[i]),
          signers: []
        })
        // If the transaction is unsigned and is to be sent from a connected account,
        // designate that it should be signed
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
        signedIndexes.push(i)
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i])
        })
        // Otherwise, designate that it should not be signed
      } else if (isSigned) {
        acc.push({
          txn: this.algosdk.decodeSignedTransaction(transactions[i]).txn,
          signers: []
        })
      } else if (!isSigned) {
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]),
          signers: []
        })
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTransaction([txnsToSign])

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result.shift()
        signedByUser && acc.push(signedByUser)
      } else if (returnGroup) {
        acc.push(transactions[i])
      }

      return acc
    }, [])

    return signedTxns
  }
}

export default PeraWalletClient
