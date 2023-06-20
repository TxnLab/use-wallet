import { getSdkError } from '@walletconnect/utils'
import type SignClient from '@walletconnect/sign-client'
import type { WalletConnectModal } from '@walletconnect/modal'
import BaseClient from '../base'
import Algod, { getAlgodClient } from '../../algod'
import { formatJsonRpcRequest } from './utils'
import { isPublicNetwork } from '../../utils/types'
import { PROVIDER_ID } from '../../constants'
import { ALGORAND_CHAINS, DEFAULT_NETWORK, ICON } from './constants'
import type { Network, Wallet, DecodedTransaction, DecodedSignedTransaction } from '../../types'
import type {
  InitParams,
  WalletConnectClientConstructor,
  WalletConnectOptions,
  WalletConnectTransaction
} from './types'

class WalletConnectClient extends BaseClient {
  #client: SignClient
  clientOptions?: WalletConnectOptions
  #modal: WalletConnectModal
  network: Network
  chain: string

  constructor({
    metadata,
    client,
    clientOptions,
    modal,
    algosdk,
    algodClient,
    network,
    chain
  }: WalletConnectClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.#modal = modal
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
    modalStatic,
    modalOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams): Promise<BaseClient | null> {
    try {
      if (!isPublicNetwork(network)) {
        throw new Error(
          `WalletConnect only supports Algorand mainnet, testnet, and betanet. "${network}" is not supported.`
        )
      }

      const chain = ALGORAND_CHAINS[network]

      // Initialize sign client
      const Client = clientStatic || (await import('@walletconnect/sign-client')).default

      const client = await Client.init(clientOptions)

      // Initialize web3modal
      const modalModule = modalStatic
        ? { WalletConnectModal: modalStatic }
        : await import('@walletconnect/modal')

      const Web3Modal = modalModule.WalletConnectModal

      const modal = new Web3Modal({
        explorerExcludedWalletIds: 'ALL',
        ...modalOptions,
        projectId: clientOptions?.projectId || '',
        walletConnectVersion: 2
      })

      // Initialize algod client
      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      // Initialize wallet client
      const walletClient = new WalletConnectClient({
        metadata: WalletConnectClient.metadata,
        client,
        clientOptions,
        modal,
        algosdk,
        algodClient,
        network,
        chain
      })

      walletClient.#subscribeToEvents()

      return walletClient
    } catch (error) {
      console.error('Error initializing', error)
      return null
    }
  }

  async connect(): Promise<Wallet> {
    const unsubscribeModal = this.#modal.subscribeModal((state) => {
      if (!state.open) {
        unsubscribeModal()
        throw new Error('Modal closed')
      }
    })

    const requiredNamespaces = {
      algorand: {
        chains: [this.chain],
        methods: ['algo_signTxn'],
        events: []
      }
    }

    const { uri, approval } = await this.#client.connect({ requiredNamespaces })

    if (uri) {
      await this.#modal.openModal({ uri, standaloneChains: [this.chain] })
    }

    try {
      const session = await approval()
      const { accounts } = session.namespaces.algorand

      return {
        ...WalletConnectClient.metadata,
        accounts: accounts.map((accountStr, index) => ({
          name: `WalletConnect ${index + 1}`,
          address: accountStr.split(':').pop() as string,
          providerId: WalletConnectClient.metadata.id
        }))
      }
    } catch (error) {
      console.error('Error connecting', error)
      throw error
    } finally {
      unsubscribeModal()
      this.#modal.closeModal()
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect() {
    const session = this.#getSession()
    if (typeof session === 'undefined') {
      return null
    }

    const { accounts } = session.namespaces.algorand

    return {
      ...WalletConnectClient.metadata,
      accounts: accounts.map((accountStr, index) => ({
        name: `WalletConnect ${index + 1}`,
        address: accountStr.split(':').pop() as string,
        providerId: WalletConnectClient.metadata.id
      }))
    }
  }

  async disconnect() {
    try {
      if (typeof this.#client === 'undefined') {
        throw new Error('WalletConnect is not initialized')
      }
      const session = this.#getSession()
      if (typeof session === 'undefined') {
        throw new Error('Session is not connected')
      }
      await this.#client.disconnect({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED')
      })
    } catch (error) {
      console.error('Error disconnecting', error)
    }
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
    const txnsToSign = decodedTxns.reduce<WalletConnectTransaction[]>((acc, txn, i) => {
      const isSigned = 'txn' in txn

      if (indexesToSign && indexesToSign.length && indexesToSign.includes(i)) {
        signedIndexes.push(i)
        acc.push({
          txn: Buffer.from(transactions[i]).toString('base64')
        })
      } else if (!isSigned && connectedAccounts.includes(this.algosdk.encodeAddress(txn['snd']))) {
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

    const session = this.#getSession()
    if (typeof session === 'undefined') {
      throw new Error('Session is not connected')
    }

    const request = formatJsonRpcRequest('algo_signTxn', [txnsToSign])

    // Play an audio file to keep Wallet Connect's web socket open on iOS
    // when the user goes into background mode.
    // await this.keepWCAliveStart()

    const response = await this.#client.request<Array<string | null>>({
      chainId: this.chain,
      topic: session.topic,
      request
    })

    // this.keepWCAliveStop()

    // Check if the result is the same length as the transactions
    const lengthsMatch = response.length === transactions.length

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = lengthsMatch ? response[i] : response.shift()
        signedByUser && acc.push(new Uint8Array(Buffer.from(signedByUser, 'base64')))
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }

  #subscribeToEvents() {
    if (typeof this.#client === 'undefined') {
      throw new Error('WalletConnect is not initialized')
    }

    this.#client.on('session_event', (args) => {
      console.log('EVENT', 'session_event', args)
    })

    this.#client.on('session_update', ({ topic, params }) => {
      console.log('EVENT', 'session_update', { topic, params })
    })

    this.#client.on('session_delete', () => {
      console.log('EVENT', 'session_delete')
    })
  }

  #getSession() {
    return this.#client.session.getAll().at(-1)
  }
}

export default WalletConnectClient
