/**
 * Helpful resources:
 * https://github.com/PureStake/algosigner/blob/develop/docs/dApp-integration.md
 */
import type _algosdk from 'algosdk'
import BaseClient from '../base'
import Algod, { getAlgodClient } from '../../algod'
import { PROVIDER_ID, DEFAULT_NETWORK } from '../../constants'
import type { DecodedTransaction, DecodedSignedTransaction, Network } from '../../types'
import { ICON } from './constants'
import type {
  WindowExtended,
  AlgoSignerTransaction,
  AlgoSigner,
  AlgoSignerClientConstructor,
  InitParams
} from './types'
import { useWalletStore } from '../../store'

class AlgoSignerClient extends BaseClient {
  #client: AlgoSigner
  network: Network
  walletStore: typeof useWalletStore

  constructor({ metadata, client, algosdk, algodClient, network }: AlgoSignerClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.network = network
    this.walletStore = useWalletStore
  }

  static metadata = {
    id: PROVIDER_ID.ALGOSIGNER,
    name: 'AlgoSigner',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams): Promise<BaseClient | null> {
    try {
      if (typeof window == 'undefined' || (window as WindowExtended).algorand === undefined) {
        throw new Error('AlgoSigner is not available.')
      }

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const algosigner = (window as WindowExtended).algorand

      return new AlgoSignerClient({
        metadata: AlgoSignerClient.metadata,
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
    const { accounts } = await this.#client.enable({ genesisID: this.getGenesisID() })

    if (accounts.length === 0) {
      throw new Error(`No accounts found for ${AlgoSignerClient.metadata.id}`)
    }

    const mappedAccounts = await Promise.all(
      accounts.map(async (address, index) => {
        // check to see if this is a rekeyed account
        const { 'auth-addr': authAddr } = await this.getAccountInfo(address)

        return {
          name: `AlgoSigner ${index + 1}`,
          address,
          providerId: AlgoSignerClient.metadata.id,
          ...(authAddr && { authAddr })
        }
      })
    )

    // sort the accounts in the order they were returned by AlgoSigner
    mappedAccounts.sort((a, b) => accounts.indexOf(a.address) - accounts.indexOf(b.address))

    return {
      ...AlgoSignerClient.metadata,
      accounts: mappedAccounts
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(onDisconnect: () => void) {
    if (window === undefined || (window as WindowExtended).algorand === undefined) {
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

    const signedIndexes: number[] = []

    // Marshal the transactions,
    // and add the signers property if they shouldn't be signed.
    const txnsToSign = decodedTxns.reduce<AlgoSignerTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      const sender = this.algosdk.encodeAddress(isSigned ? txn.txn.snd : txn.snd)
      const authAddress = this.getAuthAddress(sender) // rekeyed-to account, or undefined

      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.#client.encoding.msgpackToBase64(transactions[i]),
          ...(authAddress && { authAddr: authAddress })
        })
      } else if (!isSigned && connectedAccounts.includes(sender)) {
        signedIndexes.push(i)
        acc.push({
          txn: this.#client.encoding.msgpackToBase64(transactions[i]),
          ...(authAddress && { authAddr: authAddress })
        })
      } else {
        acc.push({
          txn: this.#client.encoding.msgpackToBase64(
            isSigned
              ? this.algosdk.decodeSignedTransaction(transactions[i]).txn.toByte()
              : this.algosdk.decodeUnsignedTransaction(transactions[i]).toByte()
          ),
          signers: []
        })
      }

      return acc
    }, [])

    // Sign them with the client.
    const result = await this.#client.signTxns(txnsToSign)

    // Join the newly signed transactions with the original group of transactions
    // if `returnGroup` is true
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = result[i]
        signedByUser && acc.push(new Uint8Array(Buffer.from(signedByUser, 'base64')))
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }

  getGenesisID() {
    if (this.network === 'betanet') {
      return 'betanet-v1.0'
    }
    if (this.network === 'testnet') {
      return 'testnet-v1.0'
    }
    if (this.network === 'mainnet') {
      return 'mainnet-v1.0'
    }
    return this.network
  }

  getAuthAddress(address: string): string | undefined {
    const accounts = this.walletStore.getState().accounts
    const account = accounts.find(
      (acct) => acct.address === address && acct.providerId === this.metadata.id
    )

    return account?.authAddr
  }
}

export default AlgoSignerClient
