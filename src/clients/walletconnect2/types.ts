import type algosdk from 'algosdk'
import type SignClient from '@walletconnect/sign-client'
import type { CommonInitParams, Metadata, Network } from '../../types'
import type { WalletConnectModal, WalletConnectModalConfig } from '@walletconnect/modal'

export type WalletConnectOptions = SignClient['opts']

export type WalletConnectModalOptions = Omit<
  WalletConnectModalConfig,
  'projectId' | 'walletConnectVersion'
>

export type InitParams = CommonInitParams & {
  clientOptions?: WalletConnectOptions
  clientStatic?: typeof SignClient
  modalStatic?: typeof WalletConnectModal
  modalOptions?: WalletConnectModalOptions
}

export type WalletConnectClientConstructor = {
  metadata: Metadata
  client: SignClient
  clientOptions?: WalletConnectOptions
  modal: WalletConnectModal
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
  chain: string
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
