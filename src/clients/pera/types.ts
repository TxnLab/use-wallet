import type algosdk from 'algosdk'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { Transaction } from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'

export type PeraWalletConnectOptions = {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
}

export interface PeraTransaction {
  txn: Transaction
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[]
}

export type PeraWalletClientConstructor = {
  metadata: Metadata
  client: PeraWalletConnect
  clientOptions?: PeraWalletConnectOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
