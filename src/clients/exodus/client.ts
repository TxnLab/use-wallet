/**
 * Documentation:
 * https://docs.exodus.com/api-reference/algorand-provider-api/
 */
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { ICON } from './constants'
import type { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { Exodus, ExodusClientConstructor, ExodusOptions, WindowExtended } from './types'

class ExodusClient extends BaseClient {
  #client: Exodus
  clientOptions: ExodusOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: ExodusClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.metadata = ExodusClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.EXODUS,
    name: 'Exodus',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({
    clientOptions,
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.EXODUS>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.EXODUS.toUpperCase()} initializing...`)

      if (typeof window == 'undefined' || (window as WindowExtended).exodus === undefined) {
        throw new Error('Exodus is not available.')
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const exodus = (window as WindowExtended).exodus.algorand

      const provider = new ExodusClient({
        metadata: ExodusClient.metadata,
        client: exodus,
        algosdk: algosdk,
        algodClient: algodClient,
        clientOptions: clientOptions || { onlyIfTrusted: false },
        network
      })

      debugLog(`${PROVIDER_ID.EXODUS.toUpperCase()} initialized`, '✅')

      return provider
    } catch (e) {
      console.warn(e)
      console.warn(
        `Error initializing ${ExodusClient.metadata.name}.`,
        'Do you have the extension installed?',
        'https://www.exodus.com/web3-wallet'
      )
      return null
    }
  }

  async connect() {
    const { address } = await this.#client.connect({
      onlyIfTrusted: this.clientOptions.onlyIfTrusted
    })

    if (!address) {
      throw new Error(`No accounts found for ${ExodusClient.metadata.id}`)
    }

    const accounts = [
      {
        name: `Exodus 1`,
        address,
        providerId: ExodusClient.metadata.id
      }
    ]

    return {
      ...ExodusClient.metadata,
      accounts
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(onDisconnect: () => void) {
    if (
      window === undefined ||
      (window as WindowExtended).exodus === undefined ||
      (window as WindowExtended).exodus.algorand.isConnected !== true
    ) {
      onDisconnect()
    }

    return null
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect() {
    return
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

    // Get the unsigned transactions.
    const txnsToSign = decodedTxns.reduce<Uint8Array[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      // If the indexes to be signed is specified
      // add it to the arrays of transactions to be signed.
      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push(transactions[i])
        // If the transaction isn't already signed and is to be sent from a connected account,
        // add it to the arrays of transactions to be signed
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
        signedIndexes.push(i)
        acc.push(transactions[i])
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTransaction(txnsToSign)

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

export default ExodusClient
