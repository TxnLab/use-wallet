import type { Transaction } from 'algosdk'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'

export type DeflyWalletConnectOptions = {
  bridge?: string
  deep_link?: string
  app_meta?: {
    logo: string
    name: string
    main_color: string
  }
  shouldShowSignTxnToast?: boolean
}

export type DeflyTransaction = {
  txn: Transaction
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[]
}

export type DeflyWalletClientConstructor = {
  metadata: Metadata
  client: DeflyWalletConnect
  clientOptions?: DeflyWalletConnectOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
