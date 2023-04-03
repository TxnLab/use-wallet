import type _algosdk from 'algosdk'
import type { Network, Metadata, CommonInitParams } from '../../types'

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
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}

export type InitParams = CommonInitParams & {
  clientOptions?: ExodusOptions
}
