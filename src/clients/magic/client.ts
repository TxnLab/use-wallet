/**
 * Documentation:
 * https://magic.link/docs/blockchains/other-chains/other/algorand
 */
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { ICON } from './constants'
import type { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { Wallet } from '../../types/wallet'
import type { MagicAuthTransaction, MagicAuthConstructor, MagicAuthConnectOptions } from './types'
import { AlgorandExtension } from '@magic-ext/algorand'
import { SDKBase, InstanceWithExtensions } from '@magic-sdk/provider'

class MagicAuth extends BaseClient {
  #client: InstanceWithExtensions<
    SDKBase,
    {
      algorand: AlgorandExtension
    }
  >
  clientOptions?: MagicAuthConnectOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: MagicAuthConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.metadata = MagicAuth.metadata
  }

  static metadata = {
    id: PROVIDER_ID.MAGIC,
    name: 'Magic',
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
  }: InitParams<PROVIDER_ID.MAGIC>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.MAGIC.toUpperCase()} initializing...`)

      let Magic
      if (clientStatic) {
        Magic = clientStatic
      } else if (getDynamicClient) {
        Magic = await getDynamicClient()
      } else if (!clientOptions || !clientOptions.apiKey) {
        throw new Error(
          'Magic provider missing API Key to be passed by required property: clientOptions'
        )
      } else {
        throw new Error(
          'Magic provider missing required property: clientStatic or getDynamicClient'
        )
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      const magic = new Magic(clientOptions?.apiKey as string, {
        extensions: {
          algorand: new AlgorandExtension({
            rpcUrl: ''
          })
        }
      })

      const provider = new MagicAuth({
        metadata: MagicAuth.metadata,
        client: magic,
        clientOptions: clientOptions as MagicAuthConnectOptions,
        algosdk,
        algodClient,
        network
      })

      debugLog(`${PROVIDER_ID.MAGIC.toUpperCase()} initialized`, '✅')

      return provider
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect(_: () => void, email: string): Promise<Wallet> {
    await this.#client.auth.loginWithMagicLink({ email: email })

    const userInfo = await this.#client.user.getMetadata()

    return {
      ...MagicAuth.metadata,
      accounts: [
        {
          name: `MagicWallet ${userInfo.email ?? ''} 1`,
          address: userInfo.publicAddress ?? 'N/A',
          providerId: MagicAuth.metadata.id,
          email: userInfo.email ?? ''
        }
      ]
    }
  }

  async reconnect() {
    const isLoggedIn = await this.#client.user.isLoggedIn()

    if (!isLoggedIn) {
      return null
    }

    const userInfo = await this.#client.user.getMetadata()

    return {
      ...MagicAuth.metadata,
      accounts: [
        {
          name: `MagicWallet ${userInfo.email ?? ''} 1`,
          address: userInfo.publicAddress ?? 'N/A',
          providerId: MagicAuth.metadata.id,
          email: userInfo.email ?? ''
        }
      ]
    }
  }

  async disconnect() {
    await this.#client.user.logout()
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
    const txnsToSign = decodedTxns.reduce<MagicAuthTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      // If the indexes to be signed is specified, designate that it should be signed
      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: Buffer.from(transactions[i]).toString('base64')
        })
        // If the indexes to be signed is specified, but it's not included in it,
        // designate that it should not be signed
      } else if (indexesToSign && indexesToSign.length && !indexesToSign.includes(i)) {
        acc.push({
          txn: isSigned
            ? Buffer.from(
                this.algosdk.encodeUnsignedTransaction(
                  this.algosdk.decodeSignedTransaction(transactions[i]).txn
                )
              ).toString('base64')
            : Buffer.from(transactions[i]).toString('base64'),
          signers: []
        })
        // If the transaction is unsigned and is to be sent from a connected account,
        // designate that it should be signed
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
        signedIndexes.push(i)
        acc.push({
          txn: Buffer.from(transactions[i]).toString('base64')
        })
        // Otherwise, designate that it should not be signed
      } else if (isSigned) {
        acc.push({
          txn: Buffer.from(
            this.algosdk.encodeUnsignedTransaction(
              this.algosdk.decodeSignedTransaction(transactions[i]).txn
            )
          ).toString('base64'),
          signers: []
        })
      } else if (!isSigned) {
        acc.push({
          txn: Buffer.from(transactions[i]).toString('base64'),
          signers: []
        })
      }

      return acc
    }, [])

    // Sign them with the client.
    try {
      console.log(txnsToSign)
      const result = await this.#client.algorand.signGroupTransactionV2(txnsToSign)
      console.log(result)
      const decodedSignedTxns: Uint8Array[] = result.map((txn: string) => {
        return Buffer.from(txn, 'base64')
      })

      // Join the newly signed transactions with the original group of transactions.
      const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
        if (signedIndexes.includes(i)) {
          const signedByUser = decodedSignedTxns.shift()
          signedByUser && acc.push(signedByUser)
        } else if (returnGroup) {
          acc.push(transactions[i])
        }

        return acc
      }, [])

      return signedTxns
    } catch (e) {
      console.error(e)
      return []
    }
  }
}

export default MagicAuth
