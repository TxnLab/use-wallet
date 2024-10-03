import algosdk from 'algosdk'
import { WalletState, addWallet, setAccounts, setActiveWallet, type State } from 'src/store'
import { compareAccounts, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { Store } from '@tanstack/store'
import type {
  SignerTransaction,
  WalletAccount,
  WalletConstructor,
  WalletId
} from 'src/wallets/types'

export interface PeraWalletConnectOptions {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
  compactMode?: boolean
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#FFEE55" width="200" height="200" />
  <path fill="#1C1C1C" d="M106.1,64.3c2.2,9.1,1.5,17-1.7,17.8c-3.1,0.8-7.4-6-9.6-15c-2.2-9.1-1.5-17,1.7-17.8 C99.6,48.5,103.9,55.2,106.1,64.3z" />
  <path fill="#1C1C1C" d="M142.2,72.1c-4.8-5.1-14.5-3.7-21.6,3.1c-7,6.9-8.8,16.6-4,21.7c4.8,5.1,14.5,3.7,21.6-3.1 C145.3,86.9,147.1,77.2,142.2,72.1z" />
  <path fill="#1C1C1C" d="M103.7,150.8c3.1-0.8,3.7-9.2,1.4-18.8c-2.3-9.6-6.7-16.8-9.8-16c-3.1,0.8-3.7,9.2-1.4,18.8 C96.2,144.3,100.6,151.5,103.7,150.8z" />
  <path fill="#1C1C1C" d="M72.1,76.8c9,2.6,15.5,7.3,14.6,10.3c-0.9,3.1-8.9,3.4-17.8,0.8s-15.5-7.3-14.6-10.3 C55.1,74.5,63.1,74.1,72.1,76.8z" />
  <path fill="#1C1C1C" d="M130.2,111.5c9.5,2.8,16.5,7.6,15.6,10.6c-0.9,3.1-9.3,3.3-18.8,0.5c-9.5-2.8-16.5-7.6-15.6-10.6 C112.2,108.9,120.7,108.7,130.2,111.5z" />
  <path fill="#1C1C1C" d="M82.1,105c-2.2-2.3-9.5,1-16.3,7.5c-6.8,6.4-10.4,13.5-8.2,15.8c2.2,2.3,9.5-1,16.3-7.5 C80.7,114.4,84.3,107.3,82.1,105z" />
</svg>
`)}`

export class PeraWallet extends BaseWallet {
  private client: PeraWalletConnect | null = null
  private options: PeraWalletConnectOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options = {},
    metadata = {}
  }: WalletConstructor<WalletId.PERA>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.options = options
    this.store = store
  }

  static defaultMetadata = {
    name: 'Pera',
    icon: ICON
  }

  private async initializeClient(): Promise<PeraWalletConnect> {
    this.logger.info('Initializing client...')
    const module = await import('@perawallet/connect')
    const PeraWalletConnect = module.default
      ? module.default.PeraWalletConnect
      : module.PeraWalletConnect

    const client = new PeraWalletConnect(this.options)
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

    this.logger.info('Connected successfully', walletState)
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
