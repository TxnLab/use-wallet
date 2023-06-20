import type _algosdk from 'algosdk'
import Algod, { getAlgodClient } from '../../algod'
import BaseClient from '../base'
import { DEFAULT_NETWORK, PROVIDER_ID } from '../../constants'
import type { Account, Wallet, Network } from '../../types'
import { ICON } from './constants'
import {
  InitParams,
  ListWalletResponse,
  InitWalletHandle,
  KMDWalletClientConstructor
} from './types'

class KMDWalletClient extends BaseClient {
  #client: _algosdk.Kmd
  #wallet: string
  #password: string
  walletId: string
  network: Network

  constructor({
    metadata,
    client,
    wallet,
    password,
    algosdk,
    algodClient,
    network
  }: KMDWalletClientConstructor) {
    super(metadata, algosdk, algodClient)

    this.#client = client
    this.#wallet = wallet
    this.#password = password
    this.walletId = ''
    this.network = network
    this.metadata = KMDWalletClient.metadata
  }

  static metadata = {
    id: PROVIDER_ID.KMD,
    name: 'KMD',
    icon: ICON,
    isWalletConnect: false
  }

  static async init({
    clientOptions,
    algodOptions,
    algosdkStatic,
    network = DEFAULT_NETWORK
  }: InitParams): Promise<BaseClient | null> {
    try {
      const {
        token = 'a'.repeat(64),
        host = 'http://localhost',
        port = '4002',
        wallet = 'unencrypted-default-wallet',
        password = ''
      } = clientOptions || {}

      const algosdk = algosdkStatic || (await Algod.init(algodOptions)).algosdk
      const algodClient = getAlgodClient(algosdk, algodOptions)
      const kmdClient = new algosdk.Kmd(token, host, port)

      return new KMDWalletClient({
        metadata: KMDWalletClient.metadata,
        password,
        wallet,
        client: kmdClient,
        algosdk: algosdk,
        algodClient: algodClient,
        network
      })
    } catch (e) {
      console.error('Error initializing...', e)
      return null
    }
  }

  async connect(): Promise<Wallet> {
    // TODO: prompt for wallet and password?
    return {
      ...KMDWalletClient.metadata,
      accounts: await this.listAccounts(this.#wallet, this.requestPassword())
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect() {
    return
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reconnect(): Promise<Wallet | null> {
    return null
  }

  requestPassword() {
    // TODO: store it locally?
    const pw = prompt('KMD password')
    return pw ? pw : ''
  }

  async getWalletToken(walletId: string, password: string): Promise<string> {
    const handleResp: InitWalletHandle = await this.#client.initWalletHandle(walletId, password)
    return handleResp.wallet_handle_token
  }

  async releaseToken(token: string): Promise<void> {
    await this.#client.releaseWalletHandle(token)
  }

  async listWallets(): Promise<Record<string, string>> {
    const walletResponse = await this.#client.listWallets()
    const walletList: Array<ListWalletResponse> = walletResponse['wallets']
    const walletMap: Record<string, string> = {}
    for (const w of walletList) {
      walletMap[w.name] = w.id
    }
    return walletMap
  }

  async listAccounts(wallet: string, password: string): Promise<Array<Account>> {
    // Get a handle token
    const walletId = await this.getWalletId()
    const token = await this.getWalletToken(walletId, password)

    // Fetch accounts and format them as lib expects
    const listResponse = await this.#client.listKeys(token)
    const addresses: Array<string> = listResponse['addresses']
    const mappedAccounts = addresses.map((address: string, index: number) => {
      return {
        name: `KMDWallet ${index + 1}`,
        address,
        providerId: KMDWalletClient.metadata.id
      }
    })

    // Release handle token
    await this.releaseToken(token)

    return mappedAccounts
  }

  async getWalletId(): Promise<string> {
    // Use cached if available
    if (this.walletId !== '') return this.walletId

    const walletMap = await this.listWallets()
    if (!(this.#wallet in walletMap)) throw Error('No wallet named: ' + this.#wallet)
    this.walletId = walletMap[this.#wallet]

    return this.walletId
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
    }) as Array<_algosdk.EncodedTransaction | _algosdk.EncodedSignedTransaction>

    // Get a handle token
    const walletId = await this.getWalletId()
    const pw = this.requestPassword()
    const token = await this.getWalletToken(walletId, pw)

    const signedTxns: Array<Uint8Array> = []
    // Sign them with the client.
    const signingPromises: Promise<Uint8Array>[] = []

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
      signingPromises.push(this.#client.signTransaction(token, pw, txn) as Promise<Uint8Array>)
    })

    const signingResults = await Promise.all(signingPromises)

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

    return formattedTxns
  }
}

export default KMDWalletClient
