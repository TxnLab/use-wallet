/**
 * Documentation:
 * https://github.com/randlabs/myalgo-connect
 */
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { ICON } from './constants'
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import type { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { MyAlgoConnectOptions, MyAlgoWalletClientConstructor } from './types'

class MyAlgoWalletClient extends BaseClient {
  #client: MyAlgoConnect
  clientOptions?: MyAlgoConnectOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: MyAlgoWalletClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.metadata = MyAlgoWalletClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.MYALGO,
    name: 'MyAlgo',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({
    clientOptions,
    algodOptions,
    clientStatic,
    getDynamicClient,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.MYALGO>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.MYALGO.toUpperCase()} initializing...`)

      let MyAlgoConnect
      if (clientStatic) {
        MyAlgoConnect = clientStatic
      } else if (getDynamicClient) {
        MyAlgoConnect = await getDynamicClient()
      } else {
        throw new Error(
          'MyAlgo Wallet provider missing required property: clientStatic or getDynamicClient'
        )
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      const myAlgo = new MyAlgoConnect({
        ...(clientOptions ? clientOptions : { disableLedgerNano: false })
      })

      const provider = new MyAlgoWalletClient({
        metadata: MyAlgoWalletClient.metadata,
        client: myAlgo,
        clientOptions,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })

      debugLog(`${PROVIDER_ID.MYALGO.toUpperCase()} initialized`, '✅')

      return provider
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect() {
    const accounts = await this.#client.connect()

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${MyAlgoWalletClient.metadata.id}`)
    }

    const mappedAccounts = accounts.map((account) => ({
      ...account,
      providerId: MyAlgoWalletClient.metadata.id
    }))

    return {
      ...MyAlgoWalletClient.metadata,
      accounts: mappedAccounts
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect() {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect() {
    return
  }

  async signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<DecodedTransaction | DecodedSignedTransaction>

    const signedIndexes: number[] = []

    // Get the transactions to be signed
    const txnsToSign = decodedTxns.reduce<Uint8Array[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      // If the indexes to be signed is specified, add it to the transactions to be signed,
      if (indexesToSign && indexesToSign.length && indexesToSign?.includes(i)) {
        signedIndexes.push(i)
        acc.push(transactions[i])
        // Otherwise, if the transaction is unsigned and is to be sent from a connected account,
        // add it to the transactions to be signed
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
        signedIndexes.push(i)
        acc.push(transactions[i])
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTransaction(txnsToSign)

    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result.shift()?.blob
        signedByUser && acc.push(signedByUser)
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }
}

export default MyAlgoWalletClient
