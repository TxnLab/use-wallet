import type _algosdk from 'algosdk'
import type WalletConnect from '@walletconnect/client'
import QRCodeModal from 'algorand-walletconnect-qrcode-modal'
import type { Network, Metadata, CommonInitParams } from '../../types'

export interface IClientMeta {
  description: string
  url: string
  icons: string[]
  name: string
}

export interface IWalletConnectSession {
  connected: boolean
  accounts: string[]
  chainId: number
  bridge: string
  key: string
  clientId: string
  clientMeta: IClientMeta | null
  peerId: string
  peerMeta: IClientMeta | null
  handshakeId: number
  handshakeTopic: string
  qrcodeModal: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    open: (uri: string, cb: any, qrcodeModalOptions?: any) => void
    close: () => void
  }
}

export type WalletConnectOptions = {
  bridge?: string
  uri?: string
  storageId?: string
  signingMethods?: string[]
  session?: IWalletConnectSession
  clientMeta?: IClientMeta
}

export type WalletConnectTransaction = {
  txn: string
  message?: string
  // if the transaction does not need to be signed,
  // because it is part of an atomic group that will be signed by another party,
  // specify an empty signers array
  signers?: string[] | []
}

export type InitParams = CommonInitParams & {
  clientOptions?: WalletConnectOptions
  clientStatic?: typeof WalletConnect
  modalStatic?: typeof QRCodeModal
}

export type WalletConnectClientConstructor = {
  metadata: Metadata
  client: WalletConnect
  clientOptions?: WalletConnectOptions
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}
