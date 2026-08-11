import algosdk from 'algosdk'
import {
  BaseWallet,
  compareAccounts,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type SignerTransaction,
  type WalletAccount,
  type WalletMetadata,
  type WalletState
} from '@txnlab/use-wallet/adapter'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'

export interface DeflyOptions {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
}

import { icon } from './icon'

const ICON = `data:image/svg+xml;base64,${btoa(icon)}`

export class DeflyAdapter extends BaseWallet<DeflyOptions> {
  private client: DeflyWalletConnect | null = null

  constructor(params: AdapterConstructorParams<DeflyOptions>) {
    super(params)
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Defly',
    icon: ICON
  }

  private async initializeClient(): Promise<DeflyWalletConnect> {
    this.logger.info('Initializing client...')
    const { DeflyWalletConnect } = await import('@blockshake/defly-connect')
    const client = new DeflyWalletConnect(this.options)
    this.client = client
    this.logger.info('Client initialized')
    return client
  }

  private manageWalletConnectSession(action: 'backup' | 'restore', targetWalletKey?: string): void {
    const key = targetWalletKey || this.walletKey
    if (typeof localStorage === 'undefined') return

    if (action === 'backup') {
      const data = localStorage.getItem('walletconnect')
      if (data) {
        localStorage.setItem(`walletconnect-${key}`, data)
        localStorage.removeItem('walletconnect')
        this.logger.debug(`Backed up WalletConnect session for ${key}`)
      }
    } else if (action === 'restore') {
      const data = localStorage.getItem(`walletconnect-${key}`)
      if (data) {
        localStorage.setItem('walletconnect', data)
        localStorage.removeItem(`walletconnect-${key}`)
        this.logger.debug(`Restored WalletConnect session for ${key}`)
      }
    }
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const currentActiveWallet = this.store.getActiveWallet()
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

    this.store.addWallet(walletState)

    this.logger.info('Connected successfully', walletState)
    return walletAccounts
  }

  public disconnect = async (): Promise<void> => {
    this.logger.info('Disconnecting...')
    const client = this.client || (await this.initializeClient())

    const currentActiveWallet = this.store.getActiveWallet()
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
    const currentActiveWallet = this.store.getActiveWallet()
    if (currentActiveWallet && currentActiveWallet === 'pera') {
      this.manageWalletConnectSession('backup', currentActiveWallet)
    }
    this.manageWalletConnectSession('restore')
    this.store.setActive()
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const walletState = this.store.getWalletState()

      // No session to resume
      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      // If Pera is active, skip reconnectSession for Defly
      if (this.store.getActiveWallet() === 'pera') {
        this.logger.info('Skipping reconnectSession for Defly (inactive)')
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
        this.store.setAccounts(walletAccounts)
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
      const signer = txn.sender.toString()
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
      const decodedObj = algosdk.msgpackRawDecode(txnBuffer)
      const isSigned = isSignedTxn(decodedObj)

      const txn: algosdk.Transaction = isSigned
        ? algosdk.decodeSignedTransaction(txnBuffer).txn
        : algosdk.decodeUnsignedTransaction(txnBuffer)

      const isIndexMatch = !indexesToSign || indexesToSign.includes(index)
      const signer = txn.sender.toString()
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
