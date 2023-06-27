/**
 * Documentation:
 * https://docs.walletconnect.com/2.0/
 */
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import { debugLog } from '../../utils/debugLog'
import { isPublicNetwork } from '../../utils/types'
import { ALGORAND_CHAINS, ICON } from './constants'
import { formatJsonRpcRequest } from './utils'
import type {
  WalletConnectModalSign,
  WalletConnectModalSignOptions,
  WalletConnectModalSignSession
} from '@walletconnect/modal-sign-html'
import type { DecodedSignedTransaction, DecodedTransaction, Network } from '../../types/node'
import type { InitParams } from '../../types/providers'
import type { Wallet } from '../../types/wallet'
import type { WalletConnectClientConstructor, WalletConnectTransaction } from './types'

class WalletConnectClient extends BaseClient {
  #client: WalletConnectModalSign
  clientOptions?: WalletConnectModalSignOptions
  network: Network
  chain: string

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network,
    chain
  }: WalletConnectClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
    this.chain = chain
    this.metadata = WalletConnectClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.WALLETCONNECT,
    name: 'WalletConnect',
    icon: ICON,
    isWalletConnect: true
  }

  static async init({
    clientOptions,
    algodOptions,
    clientStatic,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams<PROVIDER_ID.WALLETCONNECT>): Promise<BaseClient | null> {
    try {
      debugLog(`${PROVIDER_ID.WALLETCONNECT.toUpperCase()} initializing...`)

      if (!clientStatic) {
        throw new Error('WalletConnect provider missing required property: clientStatic')
      }

      if (!clientOptions) {
        throw new Error('WalletConnect provider missing required property: clientOptions')
      }

      if (!isPublicNetwork(network)) {
        throw new Error(
          `WalletConnect only supports Algorand mainnet, testnet, and betanet. "${network}" is not supported.`
        )
      }

      const chain = ALGORAND_CHAINS[network]

      const Client = clientStatic

      // Initialize client
      const client = new Client({
        ...clientOptions,
        modalOptions: {
          explorerExcludedWalletIds: 'ALL',
          ...clientOptions.modalOptions
        }
      })

      // Initialize algod client
      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      // Initialize provider client
      const provider = new WalletConnectClient({
        metadata: WalletConnectClient.metadata,
        client,
        clientOptions,
        algosdk,
        algodClient,
        network,
        chain
      })

      debugLog(`${PROVIDER_ID.WALLETCONNECT.toUpperCase()} initialized`, '✅')

      return provider
    } catch (error) {
      console.error('Error initializing WalletConnect client', error)
      return null
    }
  }

  public async connect(): Promise<Wallet> {
    const requiredNamespaces = {
      algorand: {
        chains: [this.chain],
        methods: ['algo_signTxn'],
        events: []
      }
    }

    try {
      const session: WalletConnectModalSignSession = await this.#client.connect({
        requiredNamespaces
      })

      const { accounts } = session.namespaces.algorand

      return {
        ...WalletConnectClient.metadata,
        accounts: this.#mapAccounts(accounts)
      }
    } catch (error) {
      console.error('Error connecting to WalletConnect', error)
      throw error
    }
  }

  public async reconnect() {
    const session: WalletConnectModalSignSession | undefined = await this.#client.getSession()
    if (typeof session === 'undefined') {
      return null
    }

    const { accounts } = session.namespaces.algorand

    return {
      ...WalletConnectClient.metadata,
      accounts: this.#mapAccounts(accounts)
    }
  }

  public async disconnect() {
    try {
      const session = await this.#getSession()

      await this.#client.disconnect({
        topic: session.topic,
        // replicates getSdkError('USER_DISCONNECTED') from @walletconnect/utils
        reason: {
          message: 'User disconnected.',
          code: 6000
        }
      })
    } catch (error) {
      console.error('Error disconnecting', error)
    }
  }

  public async signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign: number[] = [],
    returnGroup = true
  ) {
    // Flatten transactions array if nested
    const transactions: Uint8Array[] = Array.isArray(txnGroups[0])
      ? (txnGroups as Uint8Array[][]).flatMap((txn) => txn)
      : (txnGroups as Uint8Array[])

    const { txnsToSign, signedIndexes } = this.#composeTransactions(
      transactions,
      connectedAccounts,
      indexesToSign
    )

    const request = formatJsonRpcRequest('algo_signTxn', [txnsToSign])

    const session = await this.#getSession()

    const response = await this.#client.request<Array<string | null>>({
      chainId: this.chain,
      topic: session.topic,
      request
    })

    // Check if the result is the same length as the transactions
    const lengthsMatch = response.length === transactions.length

    // Join the signed transactions with the original group of transactions
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedTxn = lengthsMatch ? response[i] : response.shift()
        signedTxn && acc.push(new Uint8Array(Buffer.from(signedTxn, 'base64')))
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }

  #composeTransactions(
    transactions: Uint8Array[],
    connectedAccounts: string[],
    indexesToSign: number[]
  ) {
    // Decode the transactions
    const decodedTxns = transactions.map((txn) => {
      return this.algosdk.decodeObj(txn)
    }) as Array<DecodedTransaction | DecodedSignedTransaction>

    // Track signed transactions
    const signedIndexes: number[] = []

    // Marshal the transactions into WalletConnect format
    const txnsToSign = decodedTxns.reduce<WalletConnectTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      const senderAccount = !isSigned
        ? this.algosdk.encodeAddress(txn['snd'])
        : this.algosdk.encodeAddress(txn.txn['snd'])

      const shouldSign =
        indexesToSign.includes(i) || (!isSigned && connectedAccounts.includes(senderAccount))

      if (shouldSign) {
        signedIndexes.push(i)
        acc.push({
          txn: Buffer.from(transactions[i]).toString('base64')
        })
      } else {
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
      }

      return acc
    }, [])

    return { txnsToSign, signedIndexes }
  }

  async #getSession() {
    const session: WalletConnectModalSignSession | undefined = await this.#client.getSession()
    if (typeof session === 'undefined') {
      throw new Error('Session is not connected')
    }
    return session
  }

  #mapAccounts(accounts: string[]) {
    return accounts.map((accountStr, index) => ({
      name: `WalletConnect ${index + 1}`,
      address: accountStr.split(':').pop() as string,
      providerId: WalletConnectClient.metadata.id
    }))
  }
}

export default WalletConnectClient
