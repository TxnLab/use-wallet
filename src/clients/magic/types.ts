import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'
import { SDKBase, InstanceWithExtensions } from '@magic-sdk/provider'
import { AlgorandExtension } from '@magic-ext/algorand'

export type MagicAuthConnectOptions = {
  apiKey: string
}

export interface MagicAuthTransaction {
  txn: string
  /**
   * Optional list of addresses that must sign the transactions.
   * Wallet skips to sign this txn if signers is empty array.
   * If undefined, wallet tries to sign it.
   */
  signers?: string[]
}

export type MagicAuthConstructor = {
  metadata: Metadata
  client: InstanceWithExtensions<
    SDKBase,
    {
      algorand: AlgorandExtension
    }
  >
  clientOptions: MagicAuthConnectOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
