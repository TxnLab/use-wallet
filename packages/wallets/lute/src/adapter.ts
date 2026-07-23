import algosdk from 'algosdk'
import {
  BaseWallet,
  SignDataError,
  SignTxnsError,
  StdSignData,
  byteArrayToBase64,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type StdSignDataResponse,
  type StdSignMetadata,
  type WalletAccount,
  type WalletMetadata,
  type WalletState
} from '@txnlab/use-wallet/adapter'
import type LuteConnect from 'lute-connect'
import {
  SignDataError as ISignDataError,
  type SignTxnsError as ISignTxnsError,
  type WalletTransaction
} from 'lute-connect'

export interface LuteConnectOptions {
  siteName?: string
}

function isSignTxnsError(error: any): error is ISignTxnsError {
  return error instanceof Error && 'code' in error
}

function isSignDataError(error: any): error is ISignDataError {
  return error instanceof Error && 'code' in error
}

import { icon } from './icon'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

export class LuteAdapter extends BaseWallet<LuteConnectOptions> {
  private client: LuteConnect | null = null

  constructor(params: AdapterConstructorParams<LuteConnectOptions>) {
    super(params)
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Lute',
    icon: ICON
  }

  private async initializeClient(): Promise<LuteConnect> {
    this.logger.info('Initializing client...')
    const module = await import('lute-connect')
    const LuteConnect = module.default

    const client = new LuteConnect(this.options?.siteName)
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

    this.store.addWallet(walletState)

    this.logger.info('Connected successfully', walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    this.onDisconnect()
    this.logger.info('Disconnected')
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const walletState = this.store.getWalletState()

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

  public canSignData = true

  public signData = async (
    data: StdSignData,
    metadata: StdSignMetadata
  ): Promise<StdSignDataResponse> => {
    try {
      this.logger.debug('Signing data...', { data, metadata })

      const client = this.client || (await this.initializeClient())

      // Sign data
      const signDataResult = await client.signData(data, metadata)

      this.logger.debug('Data signed successfully', signDataResult)
      return signDataResult
    } catch (error) {
      if (isSignDataError(error)) {
        this.logger.error('Error signing data:', error.message, `(code: ${error.code})`)
        throw new SignDataError(error.message, error.code)
      }
      this.logger.error('Unknown error signing data:', error)
      throw error
    }
  }
}
