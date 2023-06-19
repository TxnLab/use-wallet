import type _algosdk from 'algosdk'
import type { DaffiWalletConnect } from '@daffiwallet/connect'
import type { Transaction } from 'algosdk'
import type { Network, Metadata, CommonInitParams } from '../../types'

export type DaffiWalletConnectOptions = {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
}

export interface DaffiTransaction {
  txn: Transaction
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[]
}

export type DaffiWalletClientConstructor = {
  metadata: Metadata
  client: DaffiWalletConnect
  clientOptions?: DaffiWalletConnectOptions
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}

export type InitParams = CommonInitParams & {
  clientOptions?: DaffiWalletConnectOptions
  clientStatic?: typeof DaffiWalletConnect
}
