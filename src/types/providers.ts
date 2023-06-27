import type { PROVIDER_ID } from '../constants'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { DaffiWalletConnect } from '@daffiwallet/connect'
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import type {
  WalletConnectModalSign,
  WalletConnectModalSignOptions
} from '@walletconnect/modal-sign-html'
import type algosdk from 'algosdk'
import type { AlgodClientOptions, Network } from './node'
import type { PeraWalletConnectOptions } from '../clients/pera/types'
import type { DeflyWalletConnectOptions } from '../clients/defly/types'
import type { ExodusOptions } from '../clients/exodus/types'
import type { KmdOptions } from '../clients/kmd/types'
import type { MyAlgoConnectOptions } from '../clients/myalgo/types'
import type { DaffiWalletConnectOptions } from '../clients/daffi/types'
import type { NonEmptyArray } from './utilities'
import type BaseClient from '../clients/base'

export type ProviderConfigMapping = {
  [PROVIDER_ID.PERA]: {
    clientOptions?: PeraWalletConnectOptions
    clientStatic?: typeof PeraWalletConnect
  }
  [PROVIDER_ID.DAFFI]: {
    clientOptions?: DaffiWalletConnectOptions
    clientStatic?: typeof DaffiWalletConnect
  }
  [PROVIDER_ID.DEFLY]: {
    clientOptions?: DeflyWalletConnectOptions
    clientStatic?: typeof DeflyWalletConnect
  }
  [PROVIDER_ID.WALLETCONNECT]: {
    clientOptions?: WalletConnectModalSignOptions
    clientStatic?: typeof WalletConnectModalSign
  }
  [PROVIDER_ID.MYALGO]: {
    clientOptions?: MyAlgoConnectOptions
    clientStatic?: typeof MyAlgoConnect
  }
  [PROVIDER_ID.EXODUS]: {
    clientOptions?: ExodusOptions
    clientStatic?: undefined
  }
  [PROVIDER_ID.KMD]: {
    clientOptions?: KmdOptions
    clientStatic?: undefined
  }
  [PROVIDER_ID.ALGOSIGNER]: {
    clientOptions?: undefined
    clientStatic?: undefined
  }
  [PROVIDER_ID.MNEMONIC]: {
    clientOptions?: undefined
    clientStatic?: undefined
  }
}

/**
 * Enforces correct configuration given for each provider. For example,
 * if `id` is `PROVIDER_ID.PERA`, then `clientOptions` must be of type
 * `PeraWalletConnectOptions`.
 *
 * @todo install `tsd` to test TypeScript type definitions in CI
 */
export type ProviderConfig<T extends keyof ProviderConfigMapping> = {
  [K in T]: {
    id: K
  } & ProviderConfigMapping[K]
}[T]

export type CommonInitParams = {
  network?: Network
  algodOptions?: AlgodClientOptions
  algosdkStatic?: typeof algosdk
}

export type InitParams<T extends keyof ProviderConfigMapping> = CommonInitParams &
  ProviderConfigMapping[T]

export type NodeConfig = {
  network: Network
  nodeServer: string
  nodeToken?: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader | algosdk.BaseHTTPClient
  nodePort?: string | number
  nodeHeaders?: Record<string, string>
}

type ProviderDef =
  | (ProviderConfig<PROVIDER_ID.PERA> & { clientStatic: typeof PeraWalletConnect })
  | (ProviderConfig<PROVIDER_ID.DEFLY> & { clientStatic: typeof DeflyWalletConnect })
  | (ProviderConfig<PROVIDER_ID.DAFFI> & { clientStatic: typeof DaffiWalletConnect })
  | (ProviderConfig<PROVIDER_ID.WALLETCONNECT> & {
      clientStatic: typeof WalletConnectModalSign
      clientOptions: WalletConnectModalSignOptions
    })
  | (ProviderConfig<PROVIDER_ID.MYALGO> & { clientStatic: typeof MyAlgoConnect })
  | ProviderConfig<PROVIDER_ID.EXODUS>
  | ProviderConfig<PROVIDER_ID.KMD>
  | PROVIDER_ID.EXODUS
  | PROVIDER_ID.KMD
  | PROVIDER_ID.ALGOSIGNER
  | PROVIDER_ID.MNEMONIC

export type ProvidersArray = NonEmptyArray<ProviderDef>

export type WalletClient = BaseClient

export type SupportedProviders = Partial<Record<PROVIDER_ID, WalletClient | null>>
