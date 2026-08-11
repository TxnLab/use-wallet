import algosdk from 'algosdk'
import {
  BaseWallet,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  zeroMemory,
  type AdapterConstructorParams,
  type WalletAccount,
  type WalletMetadata,
  type WalletState
} from '@txnlab/use-wallet/adapter'

interface MnemonicConstructor {
  persistToStorage?: boolean
  promptForMnemonic: () => Promise<string | null>
}

export type MnemonicOptions = Partial<Pick<MnemonicConstructor, 'promptForMnemonic'>> &
  Omit<MnemonicConstructor, 'promptForMnemonic'>

export const LOCAL_STORAGE_MNEMONIC_KEY = '@txnlab/use-wallet:v5_mnemonic'

import { icon } from './icon'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

export class MnemonicAdapter extends BaseWallet<MnemonicOptions> {
  private account: algosdk.Account | null = null
  private mnemonicOptions: MnemonicConstructor

  constructor(params: AdapterConstructorParams<MnemonicOptions>) {
    super(params)

    const {
      persistToStorage = false,
      promptForMnemonic = () => Promise.resolve(prompt('Enter 25-word mnemonic passphrase:'))
    } = this.options || {}

    this.mnemonicOptions = { persistToStorage, promptForMnemonic }

    if (this.mnemonicOptions.persistToStorage) {
      this.logger.warn(
        'Persisting mnemonics to storage is insecure. Any private key mnemonics used should never hold real Algos (i.e., on MainNet). Use with caution!'
      )
    }
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Mnemonic',
    icon: ICON
  }

  private loadMnemonicFromStorage(): string | null {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(LOCAL_STORAGE_MNEMONIC_KEY)
  }

  private saveMnemonicToStorage(mnemonic: string): void {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(LOCAL_STORAGE_MNEMONIC_KEY, mnemonic)
  }

  private removeMnemonicFromStorage(): void {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(LOCAL_STORAGE_MNEMONIC_KEY)
  }

  private checkMainnet(): void {
    try {
      const network = this.activeNetworkConfig
      if (!network.isTestnet) {
        this.logger.warn(
          'The Mnemonic wallet provider is insecure and intended for testing only. Any private key mnemonics used should never hold real Algos (i.e., on MainNet).'
        )
        throw new Error('Production network detected. Aborting.')
      }
    } catch (error) {
      this.disconnect()
      throw error
    }
  }

  private async initializeAccount(): Promise<algosdk.Account> {
    let mnemonic = this.loadMnemonicFromStorage()
    if (!mnemonic) {
      mnemonic = await this.mnemonicOptions.promptForMnemonic()
      if (!mnemonic) {
        this.account = null
        this.logger.error('No mnemonic provided')
        throw new Error('No mnemonic provided')
      }

      if (this.mnemonicOptions.persistToStorage) {
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
    const account = await this.initializeAccount()

    const walletAccount = {
      name: `${this.metadata.name} Account`,
      address: account.addr.toString()
    }

    const walletState: WalletState = {
      accounts: [walletAccount],
      activeAccount: walletAccount
    }

    this.store.addWallet(walletState)

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

    const walletState = this.store.getWalletState()

    // No session to resume
    if (!walletState) {
      this.logger.info('No session to resume')
      return
    }

    this.logger.info('Resuming session...')

    // If persisting to storage is enabled, then resume session
    if (this.mnemonicOptions.persistToStorage) {
      try {
        await this.initializeAccount()
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
      const signer = txn.sender.toString()
      const canSignTxn = signer === this.account!.addr.toString()

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
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
      const canSignTxn = !isSigned && signer === this.account!.addr.toString()

      if (isIndexMatch && canSignTxn) {
        txnsToSign.push(txn)
      }
    })

    return txnsToSign
  }

  public canUsePrivateKey = true

  /**
   * Provide scoped access to the private key via a callback.
   *
   * The callback receives a copy of the 64-byte Algorand secret key.
   * The copy is guaranteed to be zeroed from memory when the callback
   * completes, whether it succeeds or throws.
   *
   * **Note:** This method is blocked on MainNet. The Mnemonic wallet is intended
   * for development and testing only. For production use, see Web3Auth which
   * supports `withPrivateKey` on all networks.
   *
   * @example
   * ```typescript
   * const result = await wallet.withPrivateKey(async (secretKey) => {
   *   // secretKey is a 64-byte Uint8Array
   *   return doSomethingWith(secretKey)
   * })
   * // secretKey is zeroed at this point
   * ```
   */
  public withPrivateKey = async <T>(
    callback: (secretKey: Uint8Array) => Promise<T>
  ): Promise<T> => {
    // Throw error if MainNet is active
    this.checkMainnet()

    if (!this.account) {
      this.logger.error('Mnemonic wallet not connected')
      throw new Error('Mnemonic wallet not connected')
    }

    this.logger.debug('withPrivateKey: Providing private key access...')

    // Create a copy of the secret key for the consumer
    const skCopy = new Uint8Array(this.account.sk)

    try {
      return await callback(skCopy)
    } finally {
      // SECURITY: Always zero the consumer's copy
      zeroMemory(skCopy)
    }
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

      // Determine type and process transactions for signing
      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      // Sign transactions
      const signedTxns = txnsToSign.map((txn) => txn.signTxn(this.account!.sk))
      this.logger.debug('Transactions signed successfully', { signedTxns })
      return signedTxns
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
