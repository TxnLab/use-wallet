import type AVMWebProviderSDK from '@agoralabs-sh/avm-web-provider'
import type algosdk from 'algosdk'
import type { Metadata, Network } from '../../types'

export interface ClientConstructorOptions {
  avmWebClient: AVMWebProviderSDK.AVMWebClient
  avmWebProviderSDK: typeof AVMWebProviderSDK
  metadata: Metadata
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  genesisHash: string
  network: Network
}

export interface RawTransactionToSign {
  toSign: boolean
  transaction: Uint8Array
}
