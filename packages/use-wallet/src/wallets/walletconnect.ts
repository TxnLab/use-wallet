import algosdk from 'algosdk'
import { caipChainId } from 'src/network'
import { WalletState, addWallet, setAccounts, type State } from 'src/store'
import {
  base64ToByteArray,
  byteArrayToBase64,
  compareAccounts,
  flattenTxnGroup,
  formatJsonRpcRequest,
  isSignedTxn,
  isTransactionArray
} from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletConnectModal, WalletConnectModalConfig } from '@walletconnect/modal'
import type SignClient from '@walletconnect/sign-client'
import type { SessionTypes, SignClientTypes } from '@walletconnect/types'
import type {
  WalletAccount,
  WalletConstructor,
  WalletId,
  WalletTransaction
} from 'src/wallets/types'

interface SignClientOptions {
  projectId: string
  relayUrl?: string
  metadata?: SignClientTypes.Metadata
}

type WalletConnectModalOptions = Pick<
  WalletConnectModalConfig,
  | 'enableExplorer'
  | 'explorerRecommendedWalletIds'
  | 'privacyPolicyUrl'
  | 'termsOfServiceUrl'
  | 'themeMode'
  | 'themeVariables'
>

export type WalletConnectOptions = SignClientOptions & WalletConnectModalOptions

export class SessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionError'
  }
}

const icon =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIKCSB2aWV3Qm94PSIwIDAgNDgwIDQ4MCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNDgwIDQ4MDsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiMzMzk2RkY7fQo8L3N0eWxlPgo8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMTI2LjYsMTY4YzYyLjYtNjEuMywxNjQuMi02MS4zLDIyNi44LDBsNy41LDcuNGMzLjEsMy4xLDMuMSw4LDAsMTEuMWwtMjUuOCwyNS4yYy0xLjYsMS41LTQuMSwxLjUtNS43LDAKCWwtMTAuNC0xMC4yYy00My43LTQyLjgtMTE0LjUtNDIuOC0xNTguMiwwbC0xMS4xLDEwLjljLTEuNiwxLjUtNC4xLDEuNS01LjcsMGwtMjUuOC0yNS4yYy0zLjEtMy4xLTMuMS04LDAtMTEuMUwxMjYuNiwxNjh6CgkgTTQwNi43LDIyMC4ybDIyLjksMjIuNWMzLjEsMy4xLDMuMSw4LDAsMTEuMUwzMjYuMiwzNTUuMWMtMy4xLDMuMS04LjIsMy4xLTExLjMsMGwtNzMuNC03MS45Yy0wLjgtMC44LTIuMS0wLjgtMi44LDBsLTczLjQsNzEuOQoJYy0zLjEsMy4xLTguMiwzLjEtMTEuMywwTDUwLjMsMjUzLjhjLTMuMS0zLjEtMy4xLTgsMC0xMS4xbDIyLjktMjIuNWMzLjEtMy4xLDguMi0zLjEsMTEuMywwbDczLjQsNzEuOWMwLjgsMC44LDIuMSwwLjgsMi44LDAKCWw3My40LTcxLjljMy4xLTMuMSw4LjItMy4xLDExLjMsMGw3My40LDcxLjljMC44LDAuOCwyLjEsMC44LDIuOCwwbDczLjQtNzEuOUMzOTguNSwyMTcuMSw0MDMuNiwyMTcuMSw0MDYuNywyMjAuMkw0MDYuNywyMjAuMnoiLz4KPC9zdmc+Cg=='

export class WalletConnect extends BaseWallet {
  private client: SignClient | null = null
  private options: SignClientOptions
  private modal: WalletConnectModal | null = null
  private modalOptions: WalletConnectModalOptions
  private session: SessionTypes.Struct | null = null
  private chains: string[]

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.WALLETCONNECT>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    if (!options?.projectId) {
      throw new Error(`[${this.metadata.name}] Missing required option: projectId`)
    }

    const {
      projectId,
      relayUrl = 'wss://relay.walletconnect.com',
      metadata: optsMetadata,
      ...modalOptions
    } = options

    this.options = {
      projectId,
      relayUrl,
      ...optsMetadata
    }

    this.modalOptions = modalOptions
    this.chains = Object.values(caipChainId)
    this.store = store
  }

  static defaultMetadata = { name: 'WalletConnect', icon }

  private async initializeClient(): Promise<SignClient> {
    console.info(`[${this.metadata.name}] Initializing client...`)
    const SignClient = (await import('@walletconnect/sign-client')).SignClient
    const client = await SignClient.init(this.options)

    client.on('session_event', (args) => {
      console.log(`[${this.metadata.name}] EVENT`, 'session_event', args)
    })

    client.on('session_update', ({ topic, params }) => {
      console.log(`[${this.metadata.name}] EVENT`, 'session_update', { topic, params })
      const { namespaces } = params
      const session = client.session.get(topic)
      const updatedSession = { ...session, namespaces }
      this.onSessionConnected(updatedSession)
    })

    client.on('session_delete', () => {
      console.log(`[${this.metadata.name}] EVENT`, 'session_delete')
      this.session = null
    })

    this.client = client
    return client
  }

  private async initializeModal(): Promise<WalletConnectModal> {
    console.info(`[${this.metadata.name}] Initializing modal...`)
    const WalletConnectModal = (await import('@walletconnect/modal')).WalletConnectModal
    const modal = new WalletConnectModal({
      projectId: this.options.projectId,
      chains: this.chains,
      ...this.modalOptions
    })

    modal.subscribeModal((state) =>
      console.info(`[${this.metadata.name}] Modal ${state.open ? 'open' : 'closed'}`)
    )

    this.modal = modal
    return modal
  }

  private onSessionConnected(session: SessionTypes.Struct): WalletAccount[] {
    const caipAccounts = session.namespaces.algorand!.accounts

    if (!caipAccounts.length) {
      throw new Error('No accounts found!')
    }

    // @todo: Validate format of CAIP-10 accounts

    // Filter duplicate accounts (same address, different chain)
    const accounts = [...new Set(caipAccounts.map((account) => account.split(':').pop()!))]

    const walletAccounts = accounts.map((address: string, idx: number) => ({
      name: `${this.metadata.name} Account ${idx + 1}`,
      address
    }))

    const state = this.store.state
    const walletState = state.wallets[this.id]

    if (!walletState) {
      const newWalletState: WalletState = {
        accounts: walletAccounts,
        activeAccount: walletAccounts[0]
      }

      addWallet(this.store, {
        walletId: this.id,
        wallet: newWalletState
      })

      console.info(`[${this.metadata.name}] ✅ Connected.`, newWalletState)
    } else {
      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        console.warn(`[${this.metadata.name}] Session accounts mismatch, updating accounts`, {
          prev: walletState.accounts,
          current: walletAccounts
        })
        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
    }

    this.session = session
    return walletAccounts
  }

  public connect = async (): Promise<WalletAccount[]> => {
    console.info(`[${this.metadata.name}] Connecting...`)
    try {
      const client = this.client || (await this.initializeClient())
      const modal = this.modal || (await this.initializeModal())

      const requiredNamespaces = {
        algorand: {
          chains: this.chains,
          methods: ['algo_signTxn'],
          events: []
        }
      }

      const { uri, approval } = await client.connect({ requiredNamespaces })

      if (!uri) {
        throw new Error('No URI found')
      }

      await modal.openModal({ uri })

      const session = await approval()
      const walletAccounts = this.onSessionConnected(session)

      return walletAccounts
    } finally {
      this.modal?.closeModal()
    }
  }

  public disconnect = async (): Promise<void> => {
    console.info(`[${this.metadata.name}] Disconnecting...`)
    try {
      this.onDisconnect()
      if (this.client && this.session) {
        await this.client.disconnect({
          topic: this.session.topic,
          reason: {
            message: 'User disconnected.',
            code: 6000
          }
        })
      }
      console.info(`[${this.metadata.name}] Disconnected.`)
    } catch (error: any) {
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

      console.info(`[${this.metadata.name}] Resuming session...`)

      const client = this.client || (await this.initializeClient())

      if (client.session.length) {
        const lastKeyIndex = client.session.keys.length - 1
        const restoredSession = client.session.get(client.session.keys[lastKeyIndex])
        this.onSessionConnected(restoredSession)
      }
    } catch (error: any) {
      console.error(`[${this.metadata.name}] Error resuming session: ${error.message}`)
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
  ): Promise<Uint8Array[]> => {
    try {
      if (!this.session) {
        throw new SessionError(`No session found!`)
      }

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

      // Format JSON-RPC request
      const request = formatJsonRpcRequest('algo_signTxn', [txnsToSign])

      // Sign transactions
      const signTxnsResult = await client.request<Array<string | null>>({
        chainId: caipChainId[this.activeNetwork]!,
        topic: this.session.topic,
        request
      })

      // Filter out null values
      const signedTxns = signTxnsResult.reduce<Uint8Array[]>((acc, value) => {
        if (value !== null) {
          const signedTxn = base64ToByteArray(value)
          acc.push(signedTxn)
        }
        return acc
      }, [])

      return signedTxns
    } catch (error) {
      if (error instanceof SessionError) {
        this.onDisconnect()
      }
      console.error(`[${this.metadata.name}] Error signing transactions:`, error)
      throw error
    }
  }

  public transactionSigner = async (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    return this.signTransactions(txnGroup, indexesToSign)
  }
}
