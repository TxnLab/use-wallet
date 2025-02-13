import algosdk from 'algosdk'
import { WalletState, addWallet, type State } from 'src/store'
import { byteArrayToBase64, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type LuteConnect from 'lute-connect'
import type { SignTxnsError as ISignTxnsError, WalletTransaction } from 'lute-connect'
import {
  SignTxnsError,
  type WalletAccount,
  type WalletConstructor,
  type WalletId
} from 'src/wallets/types'

export interface LuteConnectOptions {
  siteName?: string
}

function isSignTxnsError(error: any): error is ISignTxnsError {
  return error instanceof Error && 'code' in error
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <path fill="#AB47BC" d="M283.7,263.6c-0.6,0-1.3-0.1-1.8-0.4c-0.6-0.3-1.1-0.8-1.5-1.3c-0.4-0.6-0.7-1.3-0.8-2 c-0.1-0.8-0.1-1.7,0.1-2.5c0.2-0.9,0.6-1.8,1.2-2.6c0.6-0.8,1.4-1.7,2.2-2.3c0.9-0.7,2.1-1.2,3.2-1.6c1.2-0.4,2.7-0.5,4-0.5 c1.4,0,3,0.3,4.4,0.8c1.5,0.5,3.1,1.4,4.3,2.3c1.4,1,2.8,2.4,3.8,3.7c1.1,1.5,2.1,3.3,2.8,5.1c0.7,1.9,1.2,4.1,1.3,6.1 c0.2,2.1,0,4.6-0.4,6.7c-0.5,2.2-1.4,4.7-2.4,6.7c-1.1,2.1-2.8,4.4-4.4,6.2c-1.8,1.9-4.1,3.7-6.3,5c-2.3,1.4-5.2,2.6-7.9,3.3 c-2.8,0.7-6.1,1.1-8.9,1.1c-3,0-6.5-0.6-9.3-1.4c-3-0.9-6.4-2.4-9.1-4c-2.8-1.7-5.8-4.2-8-6.6c-2.3-2.5-4.6-5.8-6.2-8.9 c-1.7-3.2-3.1-7.1-3.8-10.7c-0.8-3.7-1.1-8-0.9-11.8c0.2-3.9,1.1-8.3,2.3-12c1.3-3.8,3.4-8.1,5.7-11.4c2.3-3.5,5.6-7.1,8.8-9.9 c3.3-2.8,7.5-5.6,11.5-7.5c4.1-1.9,9-3.5,13.5-4.3c4.6-0.8,10-1.1,14.6-0.7c4.8,0.4,10.2,1.6,14.7,3.3c4.7,1.7,9.7,4.4,13.8,7.3 c4.2,3,8.5,7,11.7,10.9c3.3,4.1,6.5,9.2,8.7,14c2.2,4.9,4,10.9,4.9,16.3c0.9,5.5,1,11.9,0.4,17.5c-0.6,5.7-2.2,12.1-4.3,17.4 c-2.1,5.5-5.4,11.4-8.9,16.1c-3.6,4.8-8.4,9.8-13.1,13.6c-4.8,3.8-11,7.5-16.6,9.9c-5.8,2.5-12.8,4.5-19.1,5.4 c-6.4,0.9-13.9,1-20.3,0.2c-6.6-0.8-14-2.7-20.1-5.2c-6.3-2.5-13.1-6.4-18.5-10.5c-5.5-4.2-11.2-9.8-15.4-15.3 c-4.3-5.6-8.4-12.7-11.2-19.2c-2.8-6.7-4.9-14.7-5.9-21.9c-0.9-5.9-2.8-12.6-5.2-18.1c-2.3-5.4-5.9-11.2-9.5-15.8 c-3.6-4.5-8.3-9-13-12.4c-4.5-3.3-10.1-6.4-15.3-8.3c-5-1.9-11.1-3.4-16.5-3.9c-5.2-0.5-11.3-0.3-16.5,0.5c-5,0.8-10.7,2.6-15.3,4.7 c-4.5,2.1-9.4,5.1-13.2,8.3c-3.7,3.1-7.5,7.2-10.2,11.1c-2.7,3.8-5.2,8.6-6.7,13c-1.5,4.2-2.6,9.3-3,13.8c-0.3,4.3-0.1,9.4,0.7,13.7 c0.8,4.1,2.3,8.8,4.2,12.5c1.8,3.6,4.4,7.6,7.1,10.6c2.6,2.9,6,5.9,9.3,8.1c3.1,2.1,7.1,4,10.6,5.1c3.4,1.1,7.5,1.9,11.1,2 c3.5,0.2,7.4-0.2,10.8-1c3.2-0.7,6.8-2.1,9.7-3.6c2.8-1.5,5.7-3.6,8-5.8c2.2-2.1,4.3-4.8,5.9-7.4c1.5-2.5,2.8-5.5,3.5-8.3 c0.7-2.6,1.1-5.7,1.1-8.5c0-2.6-0.5-5.5-1.2-8c-0.7-2.3-1.8-4.9-3.1-6.9c-1.2-1.9-2.9-3.9-4.6-5.4c-1.6-1.4-3.6-2.8-5.5-3.7 c-1.8-0.9-4-1.6-5.9-1.9c-1.8-0.3-3.9-0.4-5.8-0.1c-1.7,0.2-3.6,0.7-5.1,1.4c-1.4,0.6-2.9,1.6-4.1,2.6c-1.1,0.9-2.1,2.2-2.9,3.4 c-0.7,1.1-1.2,2.5-1.5,3.7c-0.3,1.1-0.4,2.4-0.3,3.6c0.1,1,0.4,2.2,0.8,3.1c0.4,0.8,1,1.7,1.6,2.3c0.6,0.5,1.3,1,2.1,1.3 c0.6,0.2,1.5,0.4,2.1,0.3c0.6-0.1,1.3-0.3,1.8-0.6c0.5-0.3,1-0.8,1.2-1.4c0.3-0.5,0.7-1,1.2-1.4c0.5-0.3,1.2-0.6,1.8-0.6 c0.7-0.1,1.5,0.1,2.1,0.3c0.7,0.3,1.5,0.8,2.1,1.3c0.6,0.6,1.3,1.5,1.6,2.3c0.4,0.9,0.7,2.1,0.8,3.1c0.1,1.1,0,2.5-0.3,3.6 c-0.3,1.2-0.9,2.6-1.5,3.7c-0.7,1.2-1.8,2.4-2.9,3.4c-1.2,1-2.7,2-4.1,2.6c-1.5,0.7-3.4,1.2-5.1,1.4c-1.8,0.2-4,0.2-5.8-0.1 c-2-0.3-4.1-1-5.9-1.9c-1.9-0.9-4-2.3-5.5-3.7c-1.7-1.5-3.4-3.5-4.6-5.4c-1.3-2-2.4-4.6-3.1-6.9c-0.7-2.5-1.2-5.4-1.2-8 c0-2.7,0.4-5.8,1.1-8.5c0.7-2.8,2-5.8,3.5-8.3c1.5-2.6,3.7-5.3,5.9-7.4c2.3-2.2,5.2-4.3,8-5.8c2.9-1.6,6.5-2.9,9.7-3.6 c3.4-0.8,7.4-1.1,10.8-1c3.6,0.2,7.7,0.9,11.1,2c3.6,1.2,7.5,3.1,10.6,5.1c3.3,2.1,6.7,5.1,9.3,8.1c2.7,3,5.3,7,7.1,10.6 c1.8,3.8,3.4,8.4,4.2,12.5c0.8,4.3,1.1,9.3,0.7,13.7c-0.4,4.5-1.5,9.6-3,13.8c-1.6,4.4-4.1,9.2-6.7,13c-2.8,3.9-6.5,8-10.2,11.1 c-3.8,3.2-8.7,6.2-13.2,8.3c-4.6,2.1-10.3,3.8-15.3,4.7c-5.2,0.9-11.3,1-16.5,0.5c-5.4-0.5-11.5-2-16.5-3.9 c-5.2-2-10.8-5.1-15.3-8.3c-4.6-3.4-9.4-7.9-13-12.4c-3.7-4.6-7.2-10.4-9.5-15.8c-2.4-5.5-4.3-12.2-5.2-18.1 c-0.9-6.1-1-13.2-0.3-19.3c0.7-6.3,2.5-13.4,4.9-19.2c2.4-6,6.1-12.5,10-17.7c4-5.3,9.3-10.7,14.6-14.8c5.3-4.2,12.1-8.1,18.3-10.7 c6.4-2.7,14.1-4.8,21-5.7c7-1,15.2-1,22.2-0.1c7.2,0.9,15.2,3.1,21.9,5.8c5.6,2.2,12.3,3.9,18.3,4.6c5.8,0.7,12.6,0.5,18.4-0.4 c5.6-0.9,12-2.7,17.2-5c5.1-2.3,10.6-5.6,14.9-9.1c4.2-3.4,8.5-8,11.7-12.3c3.1-4.3,6-9.6,7.8-14.5c1.8-4.8,3.1-10.5,3.6-15.6 c0.5-4.9,0.3-10.7-0.6-15.6c-0.8-4.7-2.5-10.1-4.5-14.4c-2-4.2-4.9-8.8-7.9-12.3c-2.9-3.4-6.8-6.9-10.5-9.5 c-3.6-2.5-8.1-4.8-12.2-6.2c-4-1.4-8.7-2.4-12.9-2.7c-4-0.3-8.7,0-12.7,0.8c-3.8,0.8-8.1,2.2-11.6,4c-3.4,1.7-7,4.1-9.7,6.6 c-2.7,2.4-5.4,5.6-7.3,8.6c-1.9,2.9-3.6,6.5-4.6,9.8c-1,3.2-1.6,6.9-1.7,10.2c-0.1,3.2,0.3,6.8,1,9.9c0.7,2.9,2,6.2,3.5,8.8 c1.4,2.5,3.4,5.1,5.4,7.2c1.9,1.9,4.4,3.8,6.8,5.2c2.2,1.3,5,2.4,7.5,3c2.3,0.6,5.1,0.9,7.6,0.8c2.3-0.1,4.9-0.5,7-1.3 c2-0.7,4.2-1.7,6-2.9c1.6-1.1,3.3-2.7,4.6-4.2c1.2-1.4,2.3-3.2,3-4.9c0.7-1.6,1.2-3.5,1.3-5.1c0.2-1.5,0.1-3.3-0.2-4.9 c-0.3-1.4-0.8-2.9-1.5-4.2c-0.6-1.1-1.5-2.3-2.4-3.2c-0.8-0.8-1.9-1.5-3-2c-0.9-0.4-2.1-0.7-3.1-0.8c-0.9-0.1-1.9,0-2.8,0.3 c-0.7,0.2-1.6,0.6-2.2,1.1c-0.5,0.4-1,1.1-1.3,1.7c-0.3,0.6-0.4,1.3-0.4,1.9c0,0.6,0.2,1.2,0.6,1.7c0.3,0.5,0.5,1.2,0.6,1.7 c0,0.6-0.1,1.3-0.4,1.9c-0.3,0.6-0.8,1.3-1.3,1.7c-0.6,0.5-1.4,0.9-2.2,1.1c-0.9,0.3-1.9,0.3-2.8,0.3c-1-0.1-2.2-0.4-3.1-0.8 c-1-0.5-2.1-1.2-3-2c-0.9-0.9-1.8-2.1-2.4-3.2c-0.7-1.2-1.2-2.8-1.5-4.2c-0.3-1.5-0.4-3.3-0.2-4.9c0.2-1.7,0.7-3.6,1.3-5.1 c0.7-1.7,1.8-3.5,3-4.9c1.3-1.5,3-3.1,4.6-4.2c1.8-1.2,4-2.3,6-2.9c2.2-0.7,4.8-1.2,7-1.3c2.4-0.1,5.2,0.2,7.6,0.8 c2.5,0.6,5.3,1.7,7.5,3c2.4,1.3,4.9,3.2,6.8,5.2c2,2,4,4.7,5.4,7.2c1.5,2.6,2.7,5.9,3.5,8.8c0.8,3.1,1.1,6.7,1,9.9 c-0.1,3.3-0.7,7.1-1.7,10.2c-1,3.3-2.7,6.9-4.6,9.8c-1.9,3-4.7,6.2-7.3,8.6c-2.8,2.5-6.4,5-9.7,6.6c-3.5,1.8-7.8,3.2-11.6,4 c-4,0.8-8.7,1.1-12.7,0.8c-4.2-0.3-9-1.3-12.9-2.7c-4.1-1.4-8.6-3.7-12.2-6.2c-3.7-2.6-7.6-6.1-10.5-9.5c-3-3.6-5.9-8.1-7.9-12.3 c-2-4.4-3.7-9.7-4.5-14.4c-0.8-4.9-1.1-10.6-0.6-15.6c0.5-5.1,1.8-10.8,3.6-15.6c1.8-4.9,4.7-10.3,7.8-14.5 c3.2-4.4,7.5-8.9,11.7-12.3c4.3-3.5,9.8-6.9,14.9-9.1c5.2-2.3,11.6-4.2,17.2-5c5.8-0.9,12.6-1,18.4-0.4c6,0.7,12.7,2.4,18.3,4.6 c5.7,2.3,12,5.7,16.9,9.4c5.1,3.8,10.3,8.9,14.2,13.8c4,5.1,7.8,11.5,10.3,17.5c2.6,6.1,4.6,13.5,5.5,20c0.9,6.7,1,14.5,0.1,21.2 c-0.9,6.9-2.9,14.6-5.5,21c-2.7,6.5-6.8,13.6-11,19.3c-4.4,5.7-10.3,11.7-16,16c-4.7,3.7-9.5,8.7-13.1,13.6 c-3.5,4.7-6.8,10.7-8.9,16.1c-2.1,5.3-3.6,11.7-4.3,17.4c-0.6,5.5-0.4,12,0.4,17.5c0.9,5.3,2.6,11.3,4.9,16.3c2.2,4.8,5.4,10,8.7,14 c3.2,3.9,7.6,8,11.7,10.9c4,2.9,9.1,5.6,13.8,7.3c4.5,1.7,9.9,2.9,14.7,3.3c4.6,0.4,10,0.2,14.6-0.7c4.4-0.8,9.4-2.4,13.5-4.3 c3.9-1.9,8.2-4.6,11.5-7.5c3.2-2.7,6.4-6.4,8.8-9.9c2.3-3.4,4.4-7.6,5.7-11.4c1.2-3.7,2.1-8.1,2.3-12c0.2-3.7-0.1-8.1-0.9-11.8 c-0.8-3.5-2.2-7.5-3.8-10.7c-1.6-3.1-3.9-6.3-6.2-8.9c-2.2-2.4-5.2-4.9-8-6.6c-2.7-1.7-6-3.2-9.1-4c-2.9-0.8-6.3-1.4-9.3-1.4 c-2.9,0-6.2,0.4-8.9,1.1c-2.6,0.7-5.5,1.9-7.9,3.3c-2.2,1.3-4.5,3.2-6.3,5c-1.7,1.8-3.3,4-4.4,6.2c-1.1,2-2,4.5-2.4,6.7 c-0.4,2.1-0.6,4.5-0.4,6.7c0.2,2,0.6,4.2,1.3,6.1c0.6,1.7,1.7,3.6,2.8,5.1c1,1.3,2.4,2.7,3.8,3.7c1.3,0.9,2.8,1.8,4.3,2.3 c1.3,0.5,2.9,0.8,4.4,0.8c1.3,0,2.7-0.1,4-0.5c1.1-0.3,2.3-0.9,3.2-1.6c0.8-0.6,1.7-1.4,2.2-2.3c0.5-0.7,0.9-1.7,1.2-2.6 c0.2-0.8,0.2-1.7,0.1-2.5c-0.1-0.7-0.4-1.4-0.8-2c-0.4-0.5-0.9-1-1.5-1.3C285,263.7,284.3,263.6,283.7,263.6L283.7,263.6z" />
</svg>
`)}`

export class LuteWallet extends BaseWallet {
  private client: LuteConnect | null = null
  private options: LuteConnectOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.LUTE>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.siteName) {
      this.logger.error('Missing required option: siteName')
      throw new Error('Missing required option: siteName')
    }
    this.options = options
    this.store = store
  }

  static defaultMetadata = {
    name: 'Lute',
    icon: ICON
  }

  private async initializeClient(): Promise<LuteConnect> {
    this.logger.info('Initializing client...')
    const module = await import('lute-connect')
    const LuteConnect = module.default

    const client = new LuteConnect(this.options.siteName as string)
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  private async getGenesisId(): Promise<string> {
    const network = this.activeNetworkConfig
    if (network.genesisId) {
      return network.genesisId
    }

    const algodClient = this.getAlgodClient()
    const genesisStr = await algodClient.genesis().do()
    const genesis = algosdk.parseJSON(genesisStr, {
      intDecoding: algosdk.IntDecoding.MIXED
    })
    return `${genesis.network}-${genesis.id}`
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const client = this.client || (await this.initializeClient())
    const genesisId = await this.getGenesisId()
    const accounts = await client.connect(genesisId)

    if (accounts.length === 0) {
      this.logger.error('No accounts found!')
      throw new Error('No accounts found!')
    }

    const walletAccounts = accounts.map((address: string, idx: number) => ({
      name: `${this.metadata.name} Account ${idx + 1}`,
      address
    }))

    const activeAccount = walletAccounts[0]

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    this.logger.info('Connected successfully', walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    this.onDisconnect()
    this.logger.info('Disconnected')
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      // No session to resume
      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      this.logger.info('Resuming session...')
      await this.initializeClient()
      this.logger.info('Session resumed successfully')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = this.addresses.includes(signer)

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): WalletTransaction[] {
    const txnsToSign: WalletTransaction[] = []

    txnGroup.forEach((txnBuffer, index) => {
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = !isSigned && this.addresses.includes(signer)

      const txnString = byteArrayToBase64(txn.toByte())

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn: txnString })
      } else {
        txnsToSign.push({ txn: txnString, signers: [] })
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    try {
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })
      let txnsToSign: WalletTransaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      const client = this.client || (await this.initializeClient())

      this.logger.debug('Sending processed transactions to wallet...', txnsToSign)

      // Sign transactions
      const signTxnsResult = await client.signTxns(txnsToSign)

      this.logger.debug('Transactions signed successfully', signTxnsResult)
      return signTxnsResult
    } catch (error) {
      if (isSignTxnsError(error)) {
        this.logger.error('Error signing transactions:', error.message, `(code: ${error.code})`)
        throw new SignTxnsError(error.message, error.code)
      }
      this.logger.error('Unknown error signing transactions:', error)
      throw error
    }
  }
}
