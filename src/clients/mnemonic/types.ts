import type _algosdk from 'algosdk'
import type { Network, Metadata, CommonInitParams } from '../../types'
import { PROVIDER_ID } from '../../constants'

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
  id: PROVIDER_ID
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  network: Network
}

export type InitParams = CommonInitParams
