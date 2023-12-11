import type _algosdk from 'algosdk'
import { audio } from '../../media/audio'
import type { AccountInfo, Asset, ClientOptions, Metadata, Wallet } from '../../types/wallet'
import type { ConfirmedTxn, TxnType } from '../../types/node'
import type { RawTxnResponse, TransactionsArray, TxnInfo } from '../../types/api'

const getIsIOS = () => {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return /iPad|iPhone|iPod/.test(navigator?.userAgent) && !(window as any)?.MSStream
  } else {
    return false
  }
}

const isIOS = getIsIOS()

abstract class BaseClient {
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  clientOptions?: ClientOptions
  keepWCAlive: HTMLAudioElement
  metadata: Metadata

  static metadata: Metadata

  abstract connect(onDisconnect: () => void, email?: string): Promise<Wallet>
  abstract disconnect(): Promise<void>
  abstract reconnect(onDisconnect: () => void): Promise<Wallet | null>
  abstract signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ): Promise<Uint8Array[]>

  protected constructor(
    metadata: Metadata,
    algosdk: typeof _algosdk,
    algodClient: _algosdk.Algodv2,
    clientOptions?: ClientOptions
  ) {
    this.algosdk = algosdk
    this.algodClient = algodClient
    this.clientOptions = clientOptions
    this.keepWCAlive = new Audio()
    this.metadata = metadata
  }

  async healthCheck() {
    return await this.algodClient.healthCheck().do()
  }

  async getAccountInfo(address: string) {
    const accountInfo = await this.algodClient.accountInformation(address).do()

    if (!accountInfo) {
      throw new Error('Unable to get account information')
    }

    return accountInfo as AccountInfo
  }

  async getAssets(address: string) {
    const accountInfo = await this.algodClient.accountInformation(address).do()

    if (!accountInfo || accountInfo.assets === undefined) {
      throw new Error('Unable to get account assets')
    }

    return accountInfo.assets as Asset[]
  }

  async waitForConfirmation(txId: string, timeout = 4) {
    const confirmation = (await this.algosdk.waitForConfirmation(
      this.algodClient,
      txId,
      timeout
    )) as ConfirmedTxn

    return { txId, ...confirmation }
  }

  decodeTransaction = (txn: string, isSigned: boolean) => {
    return isSigned
      ? this.algosdk.decodeSignedTransaction(new Uint8Array(Buffer.from(txn, 'base64'))).txn
      : this.algosdk.decodeUnsignedTransaction(new Uint8Array(Buffer.from(txn, 'base64')))
  }

  logEncodedTransaction(txn: string, isSigned: boolean) {
    const txnObj = this.decodeTransaction(txn, isSigned)

    console.log('TRANSACTION', {
      isSigned,
      from: txnObj.from && this.algosdk.encodeAddress(txnObj.from.publicKey),
      to: txnObj.to && this.algosdk.encodeAddress(txnObj.to.publicKey),
      type: txnObj.type,
      txn: txnObj
    })
  }

  groupTransactionsBySender(transactions: TransactionsArray) {
    function groupBySender(objectArray: TxnInfo[]) {
      return objectArray.reduce(function (acc, obj) {
        const sender = obj.from
        if (!acc[sender]) {
          acc[sender] = []
        }
        acc[sender].push(obj)
        return acc
      }, {} as Record<string, Array<TxnInfo>>)
    }

    const decodedGroup = transactions.reduce((acc: TxnInfo[], [type, txn], index) => {
      if (type === 'u') {
        const decodedTxn = this.decodeTransaction(txn, false)
        const from = decodedTxn.from ? this.algosdk.encodeAddress(decodedTxn.from.publicKey) : ''
        const to = decodedTxn.to ? this.algosdk.encodeAddress(decodedTxn.to.publicKey) : ''
        const type = (decodedTxn.type as TxnType) || ''
        const amount = Number(decodedTxn.amount) || 0 // convert from bigint to number

        const txnObj = {
          groupIndex: index,
          amount,
          from,
          to,
          type,
          txn
        }

        acc.push(txnObj)
      }

      return acc
    }, [])

    return groupBySender(decodedGroup)
  }

  async sendRawTransactions(transactions: Uint8Array[], waitRoundsToConfirm?: number) {
    const sentTransaction = (await this.algodClient
      .sendRawTransaction(transactions)
      .do()) as RawTxnResponse

    if (!sentTransaction) {
      throw new Error('Transaction failed.')
    }

    const decodedTxn = this.algosdk.decodeSignedTransaction(transactions[0])
    const waitRounds = waitRoundsToConfirm || decodedTxn.txn.lastRound - decodedTxn.txn.firstRound

    const confirmedTransaction = await this.waitForConfirmation(sentTransaction.txId, waitRounds)

    return {
      id: sentTransaction.txId,
      ...confirmedTransaction
    }
  }

  async keepWCAliveStart() {
    // Playing an audio file prevents Wallet Connect's
    // web socket connection from being dropped when
    // iOS goes into background mode

    if (!isIOS) {
      return
    }

    this.keepWCAlive.src = audio
    this.keepWCAlive.autoplay = true
    this.keepWCAlive.volume = 0
    this.keepWCAlive.loop = true
    await this.keepWCAlive.play()
  }

  keepWCAliveStop() {
    if (!isIOS) {
      return
    }

    this.keepWCAlive.pause()
  }
}

export default BaseClient
