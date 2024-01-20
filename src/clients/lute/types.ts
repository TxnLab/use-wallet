import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'
import type LuteConnect from 'lute-connect'

export type LuteConnectOptions = {
  siteName: string
}

export type LuteClientConstructor = {
  metadata: Metadata
  client: LuteConnect
  clientOptions?: LuteConnectOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
