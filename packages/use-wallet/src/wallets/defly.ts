import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, setActiveWallet, type State } from 'src/store'
import { compareAccounts, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { Store } from '@tanstack/store'
import type {
  SignerTransaction,
  WalletAccount,
  WalletConstructor,
  WalletId
} from 'src/wallets/types'

export interface DeflyWalletConnectOptions {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" />
  <path fill="#FFFFFF" d="M779.9,684.4L512,230L244.1,684.4L512,529.5L779.9,684.4z" />
  <path fill="#FFFFFF" d="M733.1,730L512,613.5L290.9,730L512,658L733.1,730z" />
</svg>
`)}`

export class DeflyWallet extends BaseWallet {
  private client: DeflyWalletConnect | null = null
  private options: DeflyWalletConnectOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options = {},
    metadata = {}
  }: WalletConstructor<WalletId.DEFLY>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.options = options
    this.store = store
  }

  static defaultMetadata = {
    name: 'Defly',
    icon: ICON
  }

  private async initializeClient(): Promise<DeflyWalletConnect> {
    this.logger.info('Initializing client...')
    const module = await import('@blockshake/defly-connect')
    const DeflyWalletConnect = module.default
      ? module.default.DeflyWalletConnect
      : module.DeflyWalletConnect

    const client = new DeflyWalletConnect(this.options)
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const currentActiveWallet = this.store.state.activeWallet
    if (currentActiveWallet && currentActiveWallet !== this.id) {
      this.manageWalletConnectSession('backup', currentActiveWallet)
    }
    const client = this.client || (await this.initializeClient())
    const accounts = await client.connect()

    // Listen for disconnect event
    client.connector?.on('disconnect', this.onDisconnect)

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

    this.logger.info('✅ Connected.', walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    const client = this.client || (await this.initializeClient())

    const currentActiveWallet = this.store.state.activeWallet
    if (currentActiveWallet && currentActiveWallet !== this.id) {
      this.manageWalletConnectSession('backup', currentActiveWallet)
      this.manageWalletConnectSession('restore', this.id)
      await client.disconnect()
      // Wait for the disconnect to complete (race condition)
      await new Promise((resolve) => setTimeout(resolve, 500))
      this.manageWalletConnectSession('restore', currentActiveWallet)
    } else {
      await client.disconnect()
    }

    this.onDisconnect()
    this.logger.info('Disconnected')
  }

  public setActive = (): void => {
    this.logger.info(`Set active wallet: ${this.id}`)
    const currentActiveWallet = this.store.state.activeWallet
    if (currentActiveWallet && currentActiveWallet !== this.id) {
      this.manageWalletConnectSession('backup', currentActiveWallet)
    }
    this.manageWalletConnectSession('restore')
    setActiveWallet(this.store, { walletId: this.id })
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
      const accounts = await client.reconnectSession()

      if (accounts.length === 0) {
        this.logger.error('No accounts found!')
        throw new Error('No accounts found!')
      }

      const walletAccounts = accounts.map((address: string, idx: number) => ({
        name: `${this.metadata.name} Account ${idx + 1}`,
        address
      }))

      const match = compareAccounts(walletAccounts, walletState.accounts)

      if (!match) {
        this.logger.warn('Session accounts mismatch, updating accounts', {
          prev: walletState.accounts,
          current: walletAccounts
        })
        setAccounts(this.store, {
          walletId: this.id,
          accounts: walletAccounts
        })
      }
      this.logger.info('Session resumed')
    } catch (error: any) {
      this.logger.error('Error resuming session:', error.message)
      this.onDisconnect()
      throw error
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): SignerTransaction[] {
    const txnsToSign: SignerTransaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = this.addresses.includes(signer)

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn })
      } else {
        txnsToSign.push({ txn, signers: [] })
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): SignerTransaction[] {
    const txnsToSign: SignerTransaction[] = []

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

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push({ txn })
      } else {
        txnsToSign.push({ txn, signers: [] })
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
      let txnsToSign: SignerTransaction[] = []

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      const client = this.client || (await this.initializeClient())

      this.logger.debug('Sending processed transactions to wallet...', [txnsToSign])

      // Sign transactions
      const signedTxns = await client.signTransaction([txnsToSign])
      this.logger.debug('Received signed transactions from wallet', signedTxns)

      // ARC-0001 - Return null for unsigned transactions
      const result = txnsToSign.reduce<(Uint8Array | null)[]>((acc, txn) => {
        if (txn.signers && txn.signers.length == 0) {
          acc.push(null)
        } else {
          const signedTxn = signedTxns.shift()
          if (signedTxn) {
            acc.push(signedTxn)
          }
        }
        return acc
      }, [])

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
