import type _algosdk from 'algosdk'
import Algod, { getAlgodClient } from '../../algod'
import BaseWallet from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import type { TransactionsArray, Network } from '../../types'
import { ICON } from './constants'
import { InitParams, MnemonicWalletClientConstructor } from './types'
import algosdk from 'algosdk'

class MnemonicWalletClient extends BaseWallet {
  #client?: _algosdk.Account
  id: PROVIDER_ID
  network: Network

  constructor({ metadata, id, algosdk, algodClient, network }: MnemonicWalletClientConstructor) {
    super(metadata, algosdk, algodClient)

    this.id = id
    this.network = network
    this.metadata = MnemonicWalletClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.MNEMONIC,
    name: 'MNEMONIC',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({ algodOptions, algosdkStatic, network = DEFAULT_NETWORK }: InitParams) {
    try {
      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      console.log(network, algodClient)
      return new MnemonicWalletClient({
        metadata: MnemonicWalletClient.metadata,
        id: PROVIDER_ID.MNEMONIC,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async connect() {
    const password = this.requestPassword()

    if (!password) {
      this.#client = undefined
      throw new Error('Mnemonic passphrase is required')
    }

    this.#client = algosdk.mnemonicToSecretKey(password)

    return {
      ...MnemonicWalletClient.metadata,
      accounts: [
        {
          name: `MnemonicWallet 1`,
          address: this.#client.addr,
          providerId: MnemonicWalletClient.metadata.id
        }
      ]
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect() {
    this.#client = undefined
    return
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect() {
    return null
  }

  requestPassword() {
    // TODO: store it locally?
    const pass = prompt('enter mnemonic passphrase, 25 words')
    return pass ? pass : ''
  }

  signTransactions(
    connectedAccounts: string[],
    transactions: Uint8Array[],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> {
    if (!this.#client) {
      throw new Error('Client not connected')
    }

    // Decode the transactions to access their properties.
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<_algosdk.EncodedTransaction | _algosdk.EncodedSignedTransaction>

    const signedTxns: Uint8Array[] = []
    // Sign them with the client.
    const signingResults: Uint8Array[] = []

    decodedTxns.forEach((dtxn, idx) => {
      const isSigned = 'txn' in dtxn

      // push the incoming txn into signed, we'll overwrite it later
      signedTxns.push(transactions[idx])

      // Its already signed, skip it
      if (isSigned) {
        return
        // Not specified in indexes to sign, skip it
      } else if (indexesToSign && indexesToSign.length && !indexesToSign.includes(Number(idx))) {
        return
      }
      // Not to be signed by our signer, skip it
      else if (!connectedAccounts.includes(this.algosdk.encodeAddress(dtxn.snd))) {
        return
      }

      // overwrite with an empty blob
      signedTxns[idx] = new Uint8Array()

      const txn = this.algosdk.Transaction.from_obj_for_encoding(dtxn)
      const signedTxn = txn.signTxn(this.#client?.sk as Uint8Array)
      signingResults.push(signedTxn)
    })

    // Restore the newly signed txns in the correct order
    let signedIdx = 0
    const formattedTxns = signedTxns.reduce<Uint8Array[]>((acc, txn) => {
      // If its an empty array, infer that it is one of the
      // ones we wanted to have signed and overwrite the empty buff
      if (txn.length === 0) {
        acc.push(signingResults[signedIdx])

        signedIdx += 1
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return Promise.resolve(formattedTxns)
  }

  signEncodedTransactions(_transactions: TransactionsArray): Promise<Uint8Array[]> {
    throw new Error('Method not implemented.')
  }
}

export default MnemonicWalletClient
