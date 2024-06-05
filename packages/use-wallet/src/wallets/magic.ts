import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  isSignedTxnObject,
  mergeSignedTxnsWithGroup,
  normalizeTxnGroup,
  shouldSignTxnObject
} from 'src/utils'
import { BaseWallet } from './base'
import type { Store } from '@tanstack/store'
import type { InstanceWithExtensions, SDKBase } from '@magic-sdk/provider'
import type { AlgorandExtension } from '@magic-ext/algorand'
import type { WalletAccount, WalletConstructor, WalletId, WalletTransaction } from './types'
import { MagicUserMetadata } from 'magic-sdk'

/** @see https://magic.link/docs/blockchains/other-chains/other/algorand */

export interface MagicAuthOptions {
  apiKey?: string
}

export type MagicAuthClient = InstanceWithExtensions<
  SDKBase,
  {
    algorand: AlgorandExtension
  }
>

// @todo: export after switching to namespace exports (collides with Exodus.SignTxnsResult)
type SignTxnsResult = (string | undefined)[]

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPCEtLSBHZW5lcmF0ZWQgYnkgUGl4ZWxtYXRvciBQcm8gMy40LjMgLS0+Cjxzdmcgd2lkdGg9IjQ3IiBoZWlnaHQ9IjQ3IiB2aWV3Qm94PSIwIDAgNDcgNDciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8cGF0aCBpZD0iUGF0aCIgZmlsbD0iIzY4NTFmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBzdHJva2U9Im5vbmUiIGQ9Ik0gMjMuOTYwODYxIDEuODA3NjkgQyAyNS44MzUwNzcgNC4xMDMxNTMgMjcuOTAyMjE2IDYuMjM0ODkgMzAuMTM3NTM5IDguMTc4MTY5IEMgMjguNjQ3OTY4IDEzLjAwOTMyMyAyNy44NDYwOTIgMTguMTQyMDk0IDI3Ljg0NjA5MiAyMy40NjIxNTQgQyAyNy44NDYwOTIgMjguNzgyMzA3IDI4LjY0ODA2MiAzMy45MTUxNjkgMzAuMTM3NjMgMzguNzQ2MzY4IEMgMjcuOTAyMjE2IDQwLjY4OTcyNCAyNS44MzUwNzcgNDIuODIxNDc2IDIzLjk2MDg2MSA0NS4xMTY5ODUgQyAyMi4wODY1NTQgNDIuODIxNDc2IDIwLjAxOTQxNSA0MC42ODk2MzIgMTcuNzgzOTk4IDM4Ljc0NjM2OCBDIDE5LjI3MzQ3NiAzMy45MTUxNjkgMjAuMDc1NDQ1IDI4Ljc4MjQgMjAuMDc1NDQ1IDIzLjQ2MjMzNyBDIDIwLjA3NTQ0NSAxOC4xNDIyNzcgMTkuMjczNDc2IDEzLjAwOTUwNiAxNy43ODM5OTggOC4xNzgzMTggQyAyMC4wMTk0MTUgNi4yMzUwMDEgMjIuMDg2NTU0IDQuMTAzMjEgMjMuOTYwODYxIDEuODA3NjkgWiBNIDEzLjUxMTQyNyAzNS40MDY0MDMgQyAxMS4xNDUxMzkgMzMuNzQ3ODE0IDguNjMzODE2IDMyLjI4MjA2MyA2LjAwMDI2OSAzMS4wMzE5MzcgQyA2LjczMDc3NiAyOC42Mzc0NzYgNy4xMjM3NTQgMjYuMDk1NzgzIDcuMTIzNzU0IDIzLjQ2MjQyOSBDIDcuMTIzNzU0IDIwLjgyODg5MiA2LjczMDc2MiAxOC4yODcyMDEgNi4wMDAyMzUgMTUuODkyNzM4IEMgOC42MzM4MTYgMTQuNjQyNjE2IDExLjE0NTE3NSAxMy4xNzY4NjEgMTMuNTExNTAxIDExLjUxODI3NiBDIDE0LjQxNjMxMSAxNS4zNTI1NTQgMTQuODk1MDc0IDE5LjM1MTQxNCAxNC44OTUwNzQgMjMuNDYyMTU0IEMgMTQuODk1MDc0IDI3LjU3Mjk4NSAxNC40MTYyODMgMzEuNTcxOTM4IDEzLjUxMTQyNyAzNS40MDY0MDMgWiBNIDMzLjAyNzA0NiAyMy40NjIzMzcgQyAzMy4wMjcwNDYgMjcuNTcyOTg1IDMzLjUwNTc1MyAzMS41NzE4NDYgMzQuNDEwNTUzIDM1LjQwNjEyNCBDIDM2Ljc3Njg1OSAzMy43NDc2MzEgMzkuMjg4MDk0IDMyLjI4MTg3NiA0MS45MjE1MzkgMzEuMDMxODQ1IEMgNDEuMTkxMDE3IDI4LjYzNzM4NCA0MC43OTgwNjEgMjYuMDk1NjkyIDQwLjc5ODA2MSAyMy40NjIyNDYgQyA0MC43OTgwNjEgMjAuODI4OCA0MS4xOTEwMTcgMTguMjg3MjAxIDQxLjkyMTUzOSAxNS44OTI4MyBDIDM5LjI4ODA5NCAxNC42NDI3MDggMzYuNzc2NzY4IDEzLjE3NzA0OCAzNC40MTA1NTMgMTEuNTE4NTU1IEMgMzMuNTA1NzUzIDE1LjM1MjgzMSAzMy4wMjcwNDYgMTkuMzUxNjkyIDMzLjAyNzA0NiAyMy40NjIzMzcgWiIvPgo8L3N2Zz4K'

export class MagicAuth extends BaseWallet {
  private client: MagicAuthClient | null = null
  private options: MagicAuthOptions

  protected store: Store<State>
  public userInfo: MagicUserMetadata | null = null

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.MAGIC>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.apiKey) {
      throw new Error('[Magic] Missing required option: apiKey')
    }
    this.options = options
    this.store = store
  }

  static defaultMetadata = { name: 'Magic', icon }

  private async initializeClient(): Promise<MagicAuthClient> {
    console.info('[Magic] Initializing client...')
    const Magic = (await import('magic-sdk')).Magic
    const AlgorandExtension = (await import('@magic-ext/algorand')).AlgorandExtension
    const client = new Magic(this.options.apiKey as string, {
      extensions: {
        algorand: new AlgorandExtension({
          rpcUrl: ''
        })
      }
    })
    this.client = client
    return client
  }

  public connect = async (args?: Record<string, any>): Promise<WalletAccount[]> => {
    console.info('[Magic] Connecting...')
    if (!args?.email || typeof args.email !== 'string') {
      throw new Error('Magic Link provider requires an email (string) to connect')
    }

    const { email } = args

    const client = this.client || (await this.initializeClient())

    console.info(`[Magic] Logging in ${email}...`)
    await client.auth.loginWithMagicLink({ email })

    const userInfo = await client.user.getInfo()

    if (!userInfo) {
      throw new Error('User info not found!')
    }

    if (!userInfo.publicAddress) {
      throw new Error('No account found!')
    }

    this.userInfo = userInfo

    console.info(`[Magic] Login successful`, userInfo)
    const walletAccount: WalletAccount = {
      name: userInfo.email ?? 'Magic Wallet 1',
      address: userInfo.publicAddress
    }

    const walletState: WalletState = {
      accounts: [walletAccount],
      activeAccount: walletAccount
    }

    addWallet(this.store, {
      walletId: this.id,
      wallet: walletState
    })

    console.info('[Magic] ✅ Connected.', walletState)
    return [walletAccount]
  }

  public disconnect = async (): Promise<void> => {
    console.info('[Magic] Disconnecting...')
    try {
      this.onDisconnect()
      console.info(`[Magic] Logging out ${this.userInfo?.email || 'user'}...`)
      await this.client?.user.logout()
      console.info('[Magic] Disconnected.')
    } catch (error) {
      console.error(error)
    }
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      // No session to resume
      if (!walletState) {
        return
      }

      console.info('[Magic] Resuming session...')
      const client = this.client || (await this.initializeClient())
      const isLoggedIn = await client.user.isLoggedIn()

      if (!isLoggedIn) {
        console.warn('[Magic] Not logged in, please reconnect...')
        this.onDisconnect()
        return
      }

      const userInfo = await client.user.getInfo()

      if (!userInfo) {
        await client.user.logout()
        throw new Error('User info not found!')
      }

      if (!userInfo.publicAddress) {
        await client.user.logout()
        throw new Error('No account found!')
      }

      this.userInfo = userInfo

      const walletAccount: WalletAccount = {
        name: userInfo.email ?? 'Magic Wallet 1',
        address: userInfo.publicAddress
      }

      const storedAccount = walletState.accounts[0]

      const { name, address } = walletAccount
      const { name: storedName, address: storedAddress } = storedAccount

      const match = name === storedName && address === storedAddress

      if (!match) {
        console.warn(`[Magic] Session account mismatch, updating account`, {
          prev: storedAccount,
          current: walletAccount
        })
        setAccounts(this.store, {
          walletId: this.id,
          accounts: [walletAccount]
        })
      }
      console.info('[Magic] Session resumed.')
    } catch (error: any) {
      console.error(`[Magic] Error resuming session: ${error.message}`)
    }
  }

  public signTransactions = async (
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup = true
  ): Promise<Uint8Array[]> => {
    if (!this.client) {
      throw new Error('[Magic] Client not initialized!')
    }
    const txnsToSign: WalletTransaction[] = []
    const signedIndexes: number[] = []

    const msgpackTxnGroup: Uint8Array[] = normalizeTxnGroup(txnGroup)

    // Decode transactions to access properties
    const decodedObjects = msgpackTxnGroup.map((txn) => {
      return algosdk.decodeObj(txn)
    }) as Array<algosdk.EncodedTransaction | algosdk.EncodedSignedTransaction>

    // Marshal transactions into `WalletTransaction[]`
    decodedObjects.forEach((txnObject, idx) => {
      const isSigned = isSignedTxnObject(txnObject)
      const shouldSign = shouldSignTxnObject(txnObject, this.addresses, indexesToSign, idx)

      const txnBuffer: Uint8Array = msgpackTxnGroup[idx]
      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const txnBase64 = byteArrayToBase64(txn.toByte())

      if (shouldSign) {
        txnsToSign.push({ txn: txnBase64 })
        signedIndexes.push(idx)
      } else {
        txnsToSign.push({ txn: txnBase64, signers: [] })
      }
    })

    // Sign transactions
    const signTxnsResult = (await this.client.algorand.signGroupTransactionV2(
      txnsToSign
    )) as SignTxnsResult

    // Filter out undefined results
    const signedTxnsBase64 = signTxnsResult.filter(Boolean) as string[]

    // Convert base64 signed transactions to msgpack
    const signedTxns = signedTxnsBase64.map((txn) => base64ToByteArray(txn))

    // Merge signed transactions back into original group
    const txnGroupSigned = mergeSignedTxnsWithGroup(
      signedTxns,
      msgpackTxnGroup,
      signedIndexes,
      returnGroup
    )

    return txnGroupSigned
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    if (!this.client) {
      throw new Error('[Magic] Client not initialized!')
    }

    const txnsToSign = txnGroup.reduce<WalletTransaction[]>((acc, txn, idx) => {
      const txnBase64 = byteArrayToBase64(txn.toByte())

      if (indexesToSign.includes(idx)) {
        acc.push({ txn: txnBase64 })
      } else {
        acc.push({ txn: txnBase64, signers: [] })
      }
      return acc
    }, [])

    const signTxnsResult = await this.client.algorand.signGroupTransactionV2(txnsToSign)
    const signedTxnsBase64 = signTxnsResult.filter(Boolean) as string[]

    const signedTxns = signedTxnsBase64.map((txn) => base64ToByteArray(txn))
    return signedTxns
  }
}
