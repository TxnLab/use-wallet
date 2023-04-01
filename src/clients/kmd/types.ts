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

export interface ListWalletResponse {
  id: string
  name: string
  driver_name?: string
  driver_version?: number
  mnemonic_ux?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supported_txs?: Array<any>
}

export interface InitWalletHandle {
  wallet_handle_token: string
  message?: string
  error?: boolean
}

export type KMDWalletClientConstructor = {
  metadata: Metadata
  client: _algosdk.Kmd
  id: PROVIDER_ID
  algosdk: typeof _algosdk
  algodClient: _algosdk.Algodv2
  wallet: string
  password: string
  network: Network
}

export type InitParams<TClientOptions = ClientOptions> = CommonInitParams & {
  clientOptions?: TClientOptions
}
