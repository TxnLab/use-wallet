/**
 * Helpful resources:
 * https://github.com/randlabs/myalgo-connect
 */
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'

export type MyAlgoConnectOptions = {
  disableLedgerNano: boolean
}

export type MyAlgoWalletClientConstructor = {
  metadata: Metadata
  client: MyAlgoConnect
  clientOptions?: MyAlgoConnectOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
