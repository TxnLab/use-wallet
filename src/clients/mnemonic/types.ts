import type algosdk from 'algosdk'
import type { Network } from '../../types/node'
import type { Metadata } from '../../types/wallet'

export type ClientOptions = {
  wallet: string
  password: string
  host: string
  token: string
  port: string
}

export interface InitWalletHandle {
  wallet_handle_token: string
  message?: string
  error?: boolean
}

export type MnemonicWalletClientConstructor = {
  metadata: Metadata
  algosdk: typeof algosdk
  algodClient: algosdk.Algodv2
  network: Network
}
