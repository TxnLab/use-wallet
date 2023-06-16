/**
 * Helpful resources:
 * https://github.com/randlabs/myalgo-connect
 */
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import type _algosdk from 'algosdk'
import { Network, Metadata, CommonInitParams } from '../../types'

export type MyAlgoConnectOptions = {
  disableLedgerNano: boolean
}

export type MyAlgoWalletClientConstructor = {
  metadata: Metadata
  client: MyAlgoConnect
  clientOptions?: MyAlgoConnectOptions
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}

export type InitParams = CommonInitParams & {
  clientOptions?: MyAlgoConnectOptions
  clientStatic?: typeof MyAlgoConnect
}
