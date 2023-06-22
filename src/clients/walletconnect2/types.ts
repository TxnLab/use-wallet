import type {
  WalletConnectModalSign,
  WalletConnectModalSignOptions
} from '@walletconnect/modal-sign-html'
import type algosdk from 'algosdk'
import { CommonInitParams, Metadata, Network } from '../../types'

export type WalletConnectClientConstructor = {
  metadata: Metadata
  client: WalletConnectModalSign
  clientOptions: WalletConnectModalSignOptions
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
  chain: string
}

export type InitParams = CommonInitParams & {
  clientOptions?: WalletConnectModalSignOptions
  clientStatic?: typeof WalletConnectModalSign
}

export type WalletConnectTransaction = {
  txn: string
  signers?: string[]
  message?: string
}

export interface SignTxnOpts {
  message?: string
  // other options may be present, but are not standard
}

export type SignTxnParams = [WalletConnectTransaction[], SignTxnOpts?]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface JsonRpcRequest<T = any> {
  id: number
  jsonrpc: string
  method: string
  params: T
}
