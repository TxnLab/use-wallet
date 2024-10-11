import algosdk from 'algosdk'
import { NetworkId } from 'src/network'
import { StorageAdapter } from 'src/storage'
import { LOCAL_STORAGE_KEY, WalletState, addWallet, type State } from 'src/store'
import { flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import type { WalletAccount, WalletConstructor, WalletId } from 'src/wallets/types'

export type MnemonicOptions = {
  persistToStorage?: boolean
}

export const LOCAL_STORAGE_MNEMONIC_KEY = `${LOCAL_STORAGE_KEY}_mnemonic`

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#525252" width="400" height="400" />
  <path fill="#FFFFFF" d="M309.2,309.3H275l-22.2-82.7l-47.9,82.7h-38.3l73.9-128l-11.9-44.5l-99.6,172.6H90.8L217.1,90.6 h33.5l14.7,54.3h34.6l-23.6,41L309.2,309.3z" />
</svg>
`)}`

export class MnemonicWallet extends BaseWallet {
  private account: algosdk.Account | null = null
  private options: MnemonicOptions

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    options,
    metadata = {}
  }: WalletConstructor<WalletId.MNEMONIC>) {
    super({ id, metadata, getAlgodClient, store, subscribe })

    const { persistToStorage = false } = options || {}
    this.options = { persistToStorage }

    this.store = store

    if (this.options.persistToStorage) {
      this.logger.warn(
        'Persisting mnemonics to storage is insecure. Any private key mnemonics used should never hold real Algos (i.e., on MainNet). Use with caution!'
      )
    }
  }

  static defaultMetadata = {
    name: 'Mnemonic',
    icon: ICON
  }

  private loadMnemonicFromStorage(): string | null {
    return StorageAdapter.getItem(LOCAL_STORAGE_MNEMONIC_KEY)
  }

  private saveMnemonicToStorage(mnemonic: string): void {
    StorageAdapter.setItem(LOCAL_STORAGE_MNEMONIC_KEY, mnemonic)
  }

  private removeMnemonicFromStorage(): void {
    StorageAdapter.removeItem(LOCAL_STORAGE_MNEMONIC_KEY)
  }

  private checkMainnet(): void {
    try {
      const network = this.activeNetwork
      if (network === NetworkId.MAINNET) {
        this.logger.warn(
          'The Mnemonic wallet provider is insecure and intended for testing only. Any private key mnemonics used should never hold real Algos (i.e., on MainNet).'
        )
        throw new Error('MainNet active network detected. Aborting.')
      }
    } catch (error) {
      this.disconnect()
      throw error
    }
  }

  private initializeAccount(): algosdk.Account {
    let mnemonic = this.loadMnemonicFromStorage()
    if (!mnemonic) {
      mnemonic = prompt('Enter 25-word mnemonic passphrase:')
      if (!mnemonic) {
        this.account = null
        this.logger.error('No mnemonic provided')
        throw new Error('No mnemonic provided')
      }

      if (this.options.persistToStorage) {
        this.logger.warn('Mnemonic saved to localStorage.')
        this.saveMnemonicToStorage(mnemonic)
      }
    }

    const account = algosdk.mnemonicToSecretKey(mnemonic)
    this.account = account
    return account
  }

  public connect = async (): Promise<WalletAccount[]> => {
    // Throw error if MainNet is active
    this.checkMainnet()

    this.logger.info('Connecting...')
    const account = this.initializeAccount()

    const walletAccount = {
      name: `${this.metadata.name} Account`,
      address: account.addr
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
    this.account = null
    this.removeMnemonicFromStorage()
    this.logger.info('Disconnected')
  }

  public resumeSession = async (): Promise<void> => {
    // Throw error if MainNet is active
    this.checkMainnet()

    const state = this.store.state
    const walletState = state.wallets[this.id]

    // No session to resume
    if (!walletState) {
      this.logger.info('No session to resume')
      return
    }

    this.logger.info('Resuming session...')

    // If persisting to storage is enabled, then resume session
    if (this.options.persistToStorage) {
      try {
        this.initializeAccount()
        this.logger.info('Session resumed successfully')
      } catch (error: any) {
        this.logger.error('Error resuming session:', error.message)
        this.disconnect()
        throw error
      }
    } else {
      // Otherwise, do not resume session, disconnect instead
      this.logger.info('No session to resume, disconnecting...')
      this.disconnect()
    }
  }

  private processTxns(
    txnGroup: algosdk.Transaction[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

    txnGroup.forEach((txn, index) => {
      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = algosdk.encodeAddress(txn.from.publicKey)
      const canSignTxn = signer === this.account!.addr

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  private processEncodedTxns(
    txnGroup: Uint8Array[],
    indexesToSign?: number[]
  ): algosdk.Transaction[] {
    const txnsToSign: algosdk.Transaction[] = []

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
      const canSignTxn = !isSigned && signer === this.account!.addr

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  public signTransactions = async <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    // Throw error if MainNet is active
    this.checkMainnet()

    try {
      this.logger.debug('Signing transactions...', { txnGroup, indexesToSign })
      let txnsToSign: algosdk.Transaction[] = []

      const account = this.account || this.initializeAccount()

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      // Sign transactions
      const signedTxns = txnsToSign.map((txn) => txn.signTxn(account.sk))
      this.logger.debug('Transactions signed successfully', { signedTxns })
      return signedTxns
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
