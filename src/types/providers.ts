import { PROVIDER_ID } from './wallet'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type WalletConnect from '@walletconnect/client'
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import QRCodeModal from 'algorand-walletconnect-qrcode-modal'
import { AlgodClientOptions, Network } from './node'
import algosdk from 'algosdk'

type PeraWalletConnectOptions = ConstructorParameters<typeof PeraWalletConnect>[0]

type DeflyWalletConnectOptions = ConstructorParameters<typeof DeflyWalletConnect>[0]

type WalletConnectOptions = ConstructorParameters<typeof WalletConnect>[0]

type MyAlgoConnectOptions = ConstructorParameters<typeof MyAlgoConnect>[0]

type ExodusOptions = {
  onlyIfTrusted: boolean
}

type KmdOptions = {
  token?: string
  host?: string
  port?: string
  wallet?: string
  password?: string
}

export type ProviderConfigMapping = {
  [PROVIDER_ID.PERA]: {
    clientOptions?: PeraWalletConnectOptions
    clientStatic?: typeof PeraWalletConnect
  }
  [PROVIDER_ID.DEFLY]: {
    clientOptions?: DeflyWalletConnectOptions
    clientStatic?: typeof DeflyWalletConnect
  }
  [PROVIDER_ID.WALLETCONNECT]: {
    clientOptions?: WalletConnectOptions
    clientStatic?: typeof WalletConnect
    modalStatic?: typeof QRCodeModal
  }
  [PROVIDER_ID.MYALGO]: {
    clientOptions?: MyAlgoConnectOptions
    clientStatic?: typeof MyAlgoConnect
  }
  [PROVIDER_ID.EXODUS]: {
    clientOptions?: ExodusOptions
  }
  [PROVIDER_ID.KMD]: {
    clientOptions?: KmdOptions
  }
  [PROVIDER_ID.ALGOSIGNER]: Record<string, never>
  [PROVIDER_ID.MNEMONIC]: Record<string, never>
}

export interface ProviderConfig<T extends keyof ProviderConfigMapping> {
  id: T
  config?: ProviderConfigMapping[T]
}

export type CommonInitParams = {
  network?: Network
  algodOptions?: AlgodClientOptions
  algosdkStatic?: typeof algosdk
}

export type NodeConfig = {
  network: Network
  nodeServer: string
  nodeToken?: string
  nodePort?: string
}
