import algosdk from 'algosdk'
import { WalletState, addWallet, type State } from 'src/store'
import { byteArrayToBase64, flattenTxnGroup, isSignedTxn, isTransactionArray } from 'src/utils'
import { BaseWallet } from 'src/wallets/base'
import type { Store } from '@tanstack/store'
import {
  WalletId,
  type WalletAccount,
  type WalletConstructor,
  type WalletTransaction
} from 'src/wallets/types'

/**
 * AlgoVoi provider interface — matches the ARC-0027 compliant object
 * injected at `window.algorand` by the AlgoVoi browser extension.
 */
interface AlgoVoiProvider {
  id: string
  version: string
  isAlgoVoi: boolean
  enable(options?: { genesisHash?: string }): Promise<{ accounts: string[] }>
  disable(options?: { genesisHash?: string }): Promise<void>
  signTransactions(
    txns: WalletTransaction[],
    indexesToSign?: number[]
  ): Promise<(string | null)[]>
  signBytes?(data: Uint8Array, signer: string): Promise<{ sig: Uint8Array }>
}

declare global {
  interface Window {
    algorand?: AlgoVoiProvider
  }
}

const ICON = `data:image/svg+xml;base64,${btoa(`
<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="28" fill="#0D1117"/>
  <circle cx="64" cy="52" r="20" fill="none" stroke="#00E5FF" stroke-width="3"/>
  <path d="M44 52 a20 20 0 0 1 40 0" fill="none" stroke="#00E5FF" stroke-width="3"/>
  <line x1="64" y1="72" x2="64" y2="100" stroke="#00E5FF" stroke-width="3"/>
  <line x1="50" y1="86" x2="78" y2="86" stroke="#00E5FF" stroke-width="3"/>
  <text x="64" y="118" text-anchor="middle" font-family="monospace" font-size="10" fill="#8B949E">AV</text>
</svg>
`)}`

/** Timeout for enable/sign requests (3 minutes). */
const REQUEST_TIMEOUT = 180_000

/**
 * Wait for the AlgoVoi provider to be injected into the page.
 * The extension fires `algorand#initialized` once the provider is ready.
 */
function waitForProvider(timeout: number): Promise<AlgoVoiProvider> {
  return new Promise((resolve, reject) => {
    // Already injected
    if (window.algorand?.isAlgoVoi) {
      return resolve(window.algorand)
    }

    const timer = window.setTimeout(() => {
      window.removeEventListener('algorand#initialized', handler)
      reject(new Error('AlgoVoi extension not detected — timed out waiting for provider'))
    }, timeout)

    function handler() {
      window.clearTimeout(timer)
      window.removeEventListener('algorand#initialized', handler)
      if (window.algorand?.isAlgoVoi) {
        resolve(window.algorand)
      } else {
        reject(new Error('algorand#initialized fired but AlgoVoi provider not found'))
      }
    }

    window.addEventListener('algorand#initialized', handler)
  })
}

export class AlgoVoiWallet extends BaseWallet {
  private provider: AlgoVoiProvider | null = null

  protected store: Store<State>

  constructor({
    id,
    store,
    subscribe,
    getAlgodClient,
    metadata = {}
  }: WalletConstructor<WalletId.ALGOVOI>) {
    super({ id, metadata, getAlgodClient, store, subscribe })
    this.store = store
  }

  static defaultMetadata = {
    name: 'AlgoVoi',
    icon: ICON
  }

  private async getProvider(): Promise<AlgoVoiProvider> {
    if (this.provider) return this.provider
    this.logger.info('Waiting for AlgoVoi provider...')
    this.provider = await waitForProvider(REQUEST_TIMEOUT)
    this.logger.info('AlgoVoi provider detected')
    return this.provider
  }

  public connect = async (): Promise<WalletAccount[]> => {
    this.logger.info('Connecting...')
    const provider = await this.getProvider()
    const result = await provider.enable()

    if (result.accounts.length === 0) {
      this.logger.error('No accounts found!')
      throw new Error('No accounts found!')
    }

    const walletAccounts = result.accounts.map((address: string, idx: number) => ({
      name: `AlgoVoi Account ${idx + 1}`,
      address
    }))

    const walletState: WalletState = {
      accounts: walletAccounts,
      activeAccount: walletAccounts[0]
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
    try {
      const provider = await this.getProvider()
      await provider.disable()
    } catch {
      // Extension may not be available — clean up local state regardless
    }
    this.onDisconnect()
    this.logger.info('Disconnected')
  }

  public resumeSession = async (): Promise<void> => {
    try {
      const state = this.store.state
      const walletState = state.wallets[this.id]

      if (!walletState) {
        this.logger.info('No session to resume')
        return
      }

      this.logger.info('Resuming session...')
      const provider = await this.getProvider()
      const result = await provider.enable()

      if (result.accounts.length === 0) {
        throw new Error('No accounts found!')
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

      if (isTransactionArray(txnGroup)) {
        const flatTxns: algosdk.Transaction[] = flattenTxnGroup(txnGroup)
        txnsToSign = this.processTxns(flatTxns, indexesToSign)
      } else {
        const flatTxns: Uint8Array[] = flattenTxnGroup(txnGroup as Uint8Array[])
        txnsToSign = this.processEncodedTxns(flatTxns, indexesToSign)
      }

      const provider = await this.getProvider()

      this.logger.debug('Sending transactions to AlgoVoi for signing...', txnsToSign)

      const signTxnsResult = await provider.signTransactions(txnsToSign)

      // Convert base64 results to Uint8Array
      const result = signTxnsResult.map((value) => {
        if (value === null) return null
        // Decode base64 to Uint8Array
        const binaryStr = atob(value)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i)
        }
        return bytes
      })

      this.logger.debug('Transactions signed successfully', result)
      return result
    } catch (error: any) {
      this.logger.error('Error signing transactions:', error.message)
      throw error
    }
  }
}
