import type { PROVIDER_ID } from '../constants'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { DaffiWalletConnect } from '@daffiwallet/connect'
import type LuteConnect from 'lute-connect'
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
import type { LuteConnectOptions } from '../clients/lute/types'
import type { MyAlgoConnectOptions } from '../clients/myalgo/types'
import type { DaffiWalletConnectOptions } from '../clients/daffi/types'
import type { NonEmptyArray } from './utilities'
import type BaseClient from '../clients/base'
import type { CustomOptions } from '../clients/custom/types'

export type ProviderConfigMapping = {
  [PROVIDER_ID.PERA]: {
    clientOptions?: PeraWalletConnectOptions
    clientStatic?: typeof PeraWalletConnect
    getDynamicClient?: () => Promise<typeof PeraWalletConnect>
  }
  [PROVIDER_ID.DAFFI]: {
    clientOptions?: DaffiWalletConnectOptions
    clientStatic?: typeof DaffiWalletConnect
    getDynamicClient?: () => Promise<typeof DaffiWalletConnect>
  }
  [PROVIDER_ID.DEFLY]: {
    clientOptions?: DeflyWalletConnectOptions
    clientStatic?: typeof DeflyWalletConnect
    getDynamicClient?: () => Promise<typeof DeflyWalletConnect>
  }
  [PROVIDER_ID.WALLETCONNECT]: {
    clientOptions?: WalletConnectModalSignOptions
    clientStatic?: typeof WalletConnectModalSign
    getDynamicClient?: () => Promise<typeof WalletConnectModalSign>
  }
  [PROVIDER_ID.LUTE]: {
    clientOptions?: LuteConnectOptions
    clientStatic?: typeof LuteConnect
    getDynamicClient?: () => Promise<typeof LuteConnect>
  }
  [PROVIDER_ID.MYALGO]: {
    clientOptions?: MyAlgoConnectOptions
    clientStatic?: typeof MyAlgoConnect
    getDynamicClient?: () => Promise<typeof MyAlgoConnect>
  }
  [PROVIDER_ID.EXODUS]: {
    clientOptions?: ExodusOptions
    clientStatic?: undefined
    getDynamicClient?: undefined
  }
  [PROVIDER_ID.KMD]: {
    clientOptions?: KmdOptions
    clientStatic?: undefined
    getDynamicClient?: undefined
  }
  [PROVIDER_ID.CUSTOM]: {
    clientOptions?: CustomOptions
    clientStatic?: undefined
    getDynamicClient?: undefined
  }
  [PROVIDER_ID.ALGOSIGNER]: {
    clientOptions?: undefined
    clientStatic?: undefined
    getDynamicClient?: undefined
  }
  [PROVIDER_ID.MNEMONIC]: {
    clientOptions?: undefined
    clientStatic?: undefined
    getDynamicClient?: undefined
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

type StaticClient<T> = {
  clientStatic: T
  getDynamicClient?: undefined
}

type DynamicClient<T> = {
  clientStatic?: undefined
  getDynamicClient: () => Promise<T>
}

type OneOfStaticOrDynamicClient<T> = StaticClient<T> | DynamicClient<T>

type ProviderDef =
  | (ProviderConfig<PROVIDER_ID.PERA> & OneOfStaticOrDynamicClient<typeof PeraWalletConnect>)
  | (ProviderConfig<PROVIDER_ID.DEFLY> & OneOfStaticOrDynamicClient<typeof DeflyWalletConnect>)
  | (ProviderConfig<PROVIDER_ID.DAFFI> & OneOfStaticOrDynamicClient<typeof DaffiWalletConnect>)
  | (ProviderConfig<PROVIDER_ID.LUTE> &
      OneOfStaticOrDynamicClient<typeof LuteConnect> & { clientOptions: LuteConnectOptions })
  | (ProviderConfig<PROVIDER_ID.WALLETCONNECT> &
      OneOfStaticOrDynamicClient<typeof WalletConnectModalSign> & {
        clientOptions: WalletConnectModalSignOptions
      })
  | (ProviderConfig<PROVIDER_ID.MYALGO> & OneOfStaticOrDynamicClient<typeof MyAlgoConnect>)
  | ProviderConfig<PROVIDER_ID.EXODUS>
  | ProviderConfig<PROVIDER_ID.KMD>
  | ProviderConfig<PROVIDER_ID.CUSTOM>
  | PROVIDER_ID.EXODUS
  | PROVIDER_ID.KMD
  | PROVIDER_ID.ALGOSIGNER
  | PROVIDER_ID.MNEMONIC
  | PROVIDER_ID.CUSTOM

export type ProvidersArray = NonEmptyArray<ProviderDef>

export type WalletClient = BaseClient

export type SupportedProviders = Partial<Record<PROVIDER_ID, WalletClient | null>>
