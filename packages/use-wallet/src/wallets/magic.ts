import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray
} from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { InstanceWithExtensions, SDKBase } from '@magic-sdk/provider'
import type { AlgorandExtension } from '@magic-ext/algorand'
import type { MagicUserMetadata } from 'magic-sdk'
import type {
  WalletAccount,
  WalletConstructor,
  WalletId,
  WalletTransaction
} from 'src/wallets/types'

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

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 47 47" xmlns="http://www.w3.org/2000/svg">
  <path fill="#6851FF" d="M 23.960861 1.80769 C 25.835077 4.103153 27.902216 6.23489 30.137539 8.178169 C 28.647968 13.009323 27.846092 18.142094 27.846092 23.462154 C 27.846092 28.782307 28.648062 33.915169 30.13763 38.746368 C 27.902216 40.689724 25.835077 42.821476 23.960861 45.116985 C 22.086554 42.821476 20.019415 40.689632 17.783998 38.746368 C 19.273476 33.915169 20.075445 28.7824 20.075445 23.462337 C 20.075445 18.142277 19.273476 13.009506 17.783998 8.178318 C 20.019415 6.235001 22.086554 4.10321 23.960861 1.80769 Z M 13.511427 35.406403 C 11.145139 33.747814 8.633816 32.282063 6.000269 31.031937 C 6.730776 28.637476 7.123754 26.095783 7.123754 23.462429 C 7.123754 20.828892 6.730762 18.287201 6.000235 15.892738 C 8.633816 14.642616 11.145175 13.176861 13.511501 11.518276 C 14.416311 15.352554 14.895074 19.351414 14.895074 23.462154 C 14.895074 27.572985 14.416283 31.571938 13.511427 35.406403 Z M 33.027046 23.462337 C 33.027046 27.572985 33.505753 31.571846 34.410553 35.406124 C 36.776859 33.747631 39.288094 32.281876 41.921539 31.031845 C 41.191017 28.637384 40.798061 26.095692 40.798061 23.462246 C 40.798061 20.8288 41.191017 18.287201 41.921539 15.89283 C 39.288094 14.642708 36.776768 13.177048 34.410553 11.518555 C 33.505753 15.352831 33.027046 19.351692 33.027046 23.462337 Z" />
</svg>
`)}`

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
      this.logger.error('Missing required option: apiKey')
      throw new Error('Missing required option: apiKey')
    }
    this.options = options
    this.store = store
  }

  static defaultMetadata = {
    name: 'Magic',
    icon: ICON
  }

  private async initializeClient(): Promise<MagicAuthClient> {
    this.logger.info('Initializing client...')
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
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (args?: Record<string, any>): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    if (!args?.email || typeof args.email !== 'string') {
      this.logger.error('Magic Link provider requires an email (string) to connect')
      throw new Error('Magic Link provider requires an email (string) to connect')
    }

    const { email } = args

    const client = this.client || (await this.initializeClient())

    this.logger.info(`Logging in ${email}...`)
    await client.auth.loginWithMagicLink({ email })

    const userInfo = await client.user.getInfo()

    if (!userInfo) {
      this.logger.error('User info not found!')
      throw new Error('User info not found!')
    }

    if (!userInfo.publicAddress) {
      this.logger.error('No account found!')
      throw new Error('No account found!')
    }

    this.userInfo = userInfo

    this.logger.info('Login successful', userInfo)
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

    this.logger.info('Connected successfully', walletState)
    return [walletAccount]
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    this.onDisconnect()
    const client = this.client || (await this.initializeClient())
    this.logger.info(`Logging out ${this.userInfo?.email || 'user'}...`)
    await client.user.logout()
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
      const client = this.client || (await this.initializeClient())
      const isLoggedIn = await client.user.isLoggedIn()

      if (!isLoggedIn) {
        this.logger.warn('Not logged in, please reconnect...')
        this.onDisconnect()
        return
      }

      const userInfo = await client.user.getInfo()

      if (!userInfo) {
        await client.user.logout()
        this.logger.error('User info not found!')
        throw new Error('User info not found!')
      }

      if (!userInfo.publicAddress) {
        await client.user.logout()
        this.logger.error('No account found!')
        throw new Error('No account found!')
      }

      this.userInfo = userInfo

      const walletAccount: WalletAccount = {
        name: userInfo.email ?? `${this.metadata.name} Account 1`,
        address: userInfo.publicAddress
      }

      const storedAccount = walletState.accounts[0]

      const { name, address } = walletAccount
      const { name: storedName, address: storedAddress } = storedAccount

      const match = name === storedName && address === storedAddress

      if (!match) {
        this.logger.warn('Session account mismatch, updating account', {
          prev: storedAccount,
          current: walletAccount
        })
        setAccounts(this.store, {
          walletId: this.id,
          accounts: [walletAccount]
        })
      }
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
      const signer = algosdk.encodeAddress(txn.from.publicKey)
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
      const txnDecodeObj = algosdk.decodeObj(txnBuffer) as
        | algosdk.EncodedTransaction
        | algosdk.EncodedSignedTransaction

      const isSigned = isSignedTxn(txnDecodeObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
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
      const signTxnsResult = (await client.algorand.signGroupTransactionV2(
        txnsToSign
      )) as SignTxnsResult

      this.logger.debug('Received signed transactions from wallet', signTxnsResult)

      // Convert base64 to Uint8Array, undefined to null
      const result = signTxnsResult.map((value) => {
        if (value === undefined) {
          return null
        }
        return base64ToByteArray(value)
      })

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
