/**
 * Helpful resources:
 * https://developer.algorand.org/docs/get-details/walletconnect/
 */
import type _algosdk from 'algosdk'
import Algod, { getAlgodClient } from '../../algod'
import type WalletConnect from '@walletconnect/client'
import { PROVIDER_ID } from '../../constants'
import BaseClient from '../base'
import type { JsonRpcRequest } from '@json-rpc-tools/types'
import { Wallet, DecodedTransaction, DecodedSignedTransaction, Network } from '../../types'
import { DEFAULT_NETWORK, ICON } from './constants'
import {
  WalletConnectClientConstructor,
  InitParams,
  WalletConnectTransaction,
  WalletConnectOptions
} from './types'

class WalletConnectClient extends BaseClient {
  #client: WalletConnect
  clientOptions?: WalletConnectOptions
  network: Network

  constructor({
    metadata,
    client,
    clientOptions,
    algosdk,
    algodClient,
    network
  }: WalletConnectClientConstructor) {
    super(metadata, algosdk, algodClient)
    this.#client = client
    this.clientOptions = clientOptions
    this.network = network
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
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams): Promise<BaseClient | null> {
    try {
      const WalletConnect = clientStatic || (await import('@walletconnect/client')).default
      const QRCodeModal =
        modalStatic || (await import('algorand-walletconnect-qrcode-modal')).default

      const walletConnect = new WalletConnect({
        bridge: 'https://bridge.walletconnect.org',
        qrcodeModal: QRCodeModal,
        storageId: 'walletconnect-generic',
        ...clientOptions
      })

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)

      const initWallet: WalletConnectClientConstructor = {
        metadata: WalletConnectClient.metadata,
        client: walletConnect,
        clientOptions,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      }

      return new WalletConnectClient(initWallet)
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect() {
    let chainId = 416001

    if (this.network === 'betanet') {
      chainId = 416003
    } else if (this.network === 'testnet') {
      chainId = 416002
    }

    if (!this.#client.connected) {
      await this.#client.createSession({ chainId })
    }

    return new Promise<Wallet>((resolve, reject) => {
      this.#client.on('connect', (error, payload) => {
        if (error) {
          reject(error)
        }

        const { accounts } = payload.params[0]

        resolve({
          ...WalletConnectClient.metadata,
          accounts: accounts.map((address: string, index: number) => ({
            name: `Wallet Connect ${index + 1}`,
            address,
            providerId: WalletConnectClient.metadata.id
          }))
        })
      })

      this.#client.on('session_update', (error, payload) => {
        if (error) {
          reject(error)
        }

        const { accounts } = payload.params[0]

        resolve({
          ...WalletConnectClient.metadata,
          accounts: accounts.map((address: string, index: number) => ({
            name: `Wallet Connect ${index + 1}`,
            address,
            providerId: WalletConnectClient.metadata.id
          }))
        })
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect() {
    const accounts = this.#client.accounts

    if (!accounts) {
      return null
    }

    return {
      ...WalletConnectClient.metadata,
      accounts: accounts.map((address: string, index: number) => ({
        name: `Wallet Connect ${index + 1}`,
        address,
        providerId: WalletConnectClient.metadata.id
      }))
    }
  }

  check() {
    return this.#client.connected
  }

  async disconnect() {
    try {
      await this.#client.killSession()
    } catch (e) {
      console.error('Error disconnecting', e)
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

    const { formatJsonRpcRequest } = await import('@json-rpc-tools/utils')

    const requestParams = [txnsToSign]
    const request: JsonRpcRequest = formatJsonRpcRequest('algo_signTxn', requestParams)

    // Play an audio file to keep Wallet Connect's web socket open on iOS
    // when the user goes into background mode.
    await this.keepWCAliveStart()

    // Sign them with the client.
    const result: Array<string | null> = await this.#client.sendCustomRequest(request)

    this.keepWCAliveStop()

    // Check if the result is the same length as the transactions
    const lengthsMatch = result.length === transactions.length

    // Join the newly signed transactions with the original group of transactions.
    const signedTxns = transactions.reduce<Uint8Array[]>((acc, txn, i) => {
      if (signedIndexes.includes(i)) {
        const signedByUser = lengthsMatch ? result[i] : result.shift()
        signedByUser && acc.push(new Uint8Array(Buffer.from(signedByUser, 'base64')))
      } else if (returnGroup) {
        acc.push(txn)
      }

      return acc
    }, [])

    return signedTxns
  }
}

export default WalletConnectClient
