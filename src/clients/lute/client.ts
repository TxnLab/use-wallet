import { WalletTransaction } from 'lute-connect'
import Algod, { getAlgodClient } from '../../algod'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import { debugLog } from '../../utils/debugLog'
import BaseClient from '../base'
import { ICON } from './constants'
import type { LuteClientConstructor, LuteConnectOptions } from './types'
import type LuteConnect from 'lute-connect'

class LuteClient extends BaseClient {
  #client: LuteConnect
  clientOptions?: LuteConnectOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: LuteClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.metadata = LuteClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.LUTE,
    name: 'Lute',
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
  }: InitParams<PROVIDER_ID.LUTE>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.LUTE.toUpperCase()} initializing...`)

      let LuteConnect
      if (clientStatic) {
        LuteConnect = clientStatic
      } else if (getDynamicClient) {
        LuteConnect = await getDynamicClient()
      } else {
        throw new Error(
          'Lute Wallet provider missing required property: clientStatic or getDynamicClient'
        )
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      const lute = new LuteConnect(clientOptions ? clientOptions.siteName : 'This site')
      const provider = new LuteClient({
        metadata: LuteClient.metadata,
        client: lute,
        clientOptions,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })

      debugLog(`${PROVIDER_ID.LUTE.toUpperCase()} initialized`, '✅')

      return provider
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect() {
    const genesis = (await this.algodClient.genesis().do()) as { network: string; id: string }
    const genesisID = `${genesis.network}-${genesis.id}`
    const addresses = await this.#client.connect(genesisID)

    if (addresses.length === 0) {
      throw new Error(`No accounts found for ${LuteClient.metadata.id}`)
    }

    const mappedAccounts = addresses.map((address: string, index: number) => ({
      name: `Lute Wallet ${index + 1}`,
      address,
      providerId: LuteClient.metadata.id
    }))

    return {
      ...LuteClient.metadata,
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

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<WalletTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      // If the indexes to be signed is specified, designate that it should be signed
      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]).toString()
        })
        // If the indexes to be signed is specified, but it's not included in it,
        // designate that it should not be signed
      } else if (indexesToSign && indexesToSign.length && !indexesToSign.includes(i)) {
        acc.push({
          txn: isSigned
            ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toString()
            : this.algosdk.decodeUnsignedTransaction(transactions[i]).toString(),
          stxn: isSigned ? Buffer.from(transactions[i]).toString('base64') : undefined,
          signers: []
        })
        // If the transaction is unsigned and is to be sent from a connected account,
        // designate that it should be signed
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
        signedIndexes.push(i)
        acc.push({
          txn: this.algosdk.decodeUnsignedTransaction(transactions[i]).toString()
        })
        // Otherwise, designate that it should not be signed
      } else if (isSigned) {
        acc.push({
          txn: isSigned
            ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toString()
            : this.algosdk.decodeUnsignedTransaction(transactions[i]).toString(),
          stxn: isSigned ? Buffer.from(transactions[i]).toString('base64') : undefined,
          signers: []
        })
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = (await this.#client.signTxns(txnsToSign)) as (Uint8Array | null)[]

    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result.shift()
        signedByUser && acc.push(signedByUser)
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }
}

export default LuteClient
