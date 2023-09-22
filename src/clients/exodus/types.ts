import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'

export type ExodusOptions = {
  onlyIfTrusted: boolean
}

export type WindowExtended = { exodus: { algorand: Exodus } } & Window & typeof globalThis

export type Bytes = Readonly<Uint8Array>

export type Exodus = {
  isConnected: boolean
  address: string | null
  connect: ({ onlyIfTrusted }: { onlyIfTrusted: boolean }) => Promise<{
    address: string
  }>
  disconnect: () => void
  signAndSendTransaction(transactions: Bytes[]): Promise<{
    txId: string
  }>
  signTransaction(transactions: Bytes[]): Promise<Bytes[]>
}

export type ExodusClientConstructor = {
  metadata: Metadata
  client: Exodus
  clientOptions: ExodusOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
