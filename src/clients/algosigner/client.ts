/**
 * Helpful resources:
 * https://github.com/PureStake/algosigner/blob/develop/docs/dApp-integration.md
 */
import type _algosdk from 'algosdk'
import BaseWallet from '../base'
import Algod, { getAlgodClient } from '../../algod'
import { PROVIDER_ID, DEFAULT_NETWORK } from '../../constants'
import type { DecodedTransaction, DecodedSignedTransaction, Network } from '../../types'
import { ICON } from './constants'
import type {
  WindowExtended,
  AlgoSignerTransaction,
  SupportedLedgers,
  AlgoSigner,
  AlgoSignerClientConstructor,
  InitParams
} from './types'

const getNetwork = (network: string): SupportedLedgers => {
  if (network === 'betanet') {
    return 'BetaNet'
  }

  if (network === 'testnet') {
    return 'TestNet'
  }

  if (network === 'mainnet') {
    return 'MainNet'
  }

  return network
}

class AlgoSignerClient extends BaseWallet {
  #client: AlgoSigner
  network: Network

  constructor({ metadata, client, algosdk, algodClient, network }: AlgoSignerClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.network = network
  }

  static metadata = {
    id: PROVIDER_ID.ALGOSIGNER,
    name: 'AlgoSigner',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({ algodOptions, algosdkStatic, network = DEFAULT_NETWORK }: InitParams) {
    try {
      if (typeof window == 'undefined' || (window as WindowExtended).AlgoSigner === undefined) {
        throw new Error('AlgoSigner is not available.')
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const algosigner = (window as WindowExtended).AlgoSigner

      return new AlgoSignerClient({
        metadata: AlgoSignerClient.metadata,
        id: PROVIDER_ID.ALGOSIGNER,
        client: algosigner,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })
    } catch (e) {
      console.warn(e)
      console.warn(
        `Error initializing ${AlgoSignerClient.metadata.name}.`,
        'Do you have the extension installed?',
        'https://www.purestake.com/technology/algosigner'
      )
      return null
    }
  }

  async connect() {
    await this.#client.connect()

    const accounts = await this.#client.accounts({
      ledger: getNetwork(this.network)
    })

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${AlgoSignerClient.metadata.id}`)
    }

    const mappedAccounts = accounts.map(({ address }, index) => ({
      name: `AlgoSigner ${index + 1}`,
      address,
      providerId: AlgoSignerClient.metadata.id
    }))

    return {
      ...AlgoSignerClient.metadata,
      accounts: mappedAccounts
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(onDisconnect: () => void) {
    if (window === undefined || (window as WindowExtended).AlgoSigner === undefined) {
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
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ) {
    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<DecodedTransaction | DecodedSignedTransaction>

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<AlgoSignerTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      const txnObj: AlgoSignerTransaction = {
        txn: this.#client.encoding.msgpackToBase64(transactions[i])
      }

      if (indexesToSign && indexesToSign.length && !indexesToSign.includes(i)) {
        txnObj.txn = this.#client.encoding.msgpackToBase64(
          isSigned
            ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toByte()
            : this.algosdk.decodeUnsignedTransaction(transactions[i]).toByte()
        )
        txnObj.signers = []
      } else if (
        !connectedAccounts.includes(
          this.algosdk.encodeAddress(isSigned ? txn.txn['snd'] : txn['snd'])
        )
      ) {
        txnObj.txn = this.#client.encoding.msgpackToBase64(
          isSigned
            ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toByte()
            : this.algosdk.decodeUnsignedTransaction(transactions[i]).toByte()
        )
        txnObj.signers = []
      }

      acc.push(txnObj)

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTxn(txnsToSign)

    // Join the newly signed transactions with the original group of transactions
    // if 'returnGroup' param is specified
    const signedTxns = result.reduce<Uint8Array[]>((acc, txn, i) => {
      if (txn) {
        acc.push(new Uint8Array(Buffer.from(txn.blob, 'base64')))
      } else if (returnGroup) {
        acc.push(transactions[i])
      }

      return acc
    }, [])

    return signedTxns
  }
}

export default AlgoSignerClient
