/**
 * Helpful resources:
 * https://docs.exodus.com/api-reference/algorand-provider-api/
 */
import type _algosdk from 'algosdk'
import BaseWallet from '../base'
import Algod, { getAlgodClient } from '../../algod'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import type { DecodedTransaction, DecodedSignedTransaction, Network } from '../../types'
import { ICON } from './constants'
import { InitParams, WindowExtended, Exodus, ExodusClientConstructor } from './types'

class ExodusClient extends BaseWallet {
  #client: Exodus
  #onlyIfTrusted: boolean
  network: Network

  constructor({
    metadata,
    client,
    algosdk,
    algodClient,
    onlyIfTrusted,
    network
  }: ExodusClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.#onlyIfTrusted = onlyIfTrusted
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
  }: InitParams) {
    try {
      if (typeof window == 'undefined' || (window as WindowExtended).exodus === undefined) {
        throw new Error('Exodus is not available.')
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const exodus = (window as WindowExtended).exodus.algorand

      return new ExodusClient({
        metadata: ExodusClient.metadata,
        id: PROVIDER_ID.EXODUS,
        client: exodus,
        algosdk: algosdk,
        algodClient: algodClient,
        onlyIfTrusted: clientOptions?.onlyIfTrusted || false,
        network
      })
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
      onlyIfTrusted: this.#onlyIfTrusted
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
    transactions: Array<Uint8Array>,
    indexesToSign?: number[],
    returnGroup = true
  ) {
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
