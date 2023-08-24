import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata, Wallet } from '../../types/wallet'

export type CustomOptions = {
  name: string
  icon?: string
  getProvider: (params: {
    network?: Network
    algod?: algosdk.Algodv2
    algosdkStatic?: typeof algosdk
  }) => CustomProvider
}

export type CustomProvider = {
  connect(): Promise<Wallet>
  disconnect(): Promise<void>
  reconnect(): Promise<Wallet | null>
  signTransactions(
    connectedAccounts: string[],
    txnGroups: Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ): Promise<Uint8Array[]>
}

export type CustomWalletClientConstructor = {
  providerProxy: CustomProvider
  metadata: Metadata
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
