import { PROVIDER_ID } from '../constants'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { DaffiWalletConnect } from '@daffiwallet/connect'
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import type { Web3ModalSign, Web3ModalSignOptions } from '@web3modal/sign-html'
import type algosdk from 'algosdk'
import type { AlgodClientOptions, Network } from './node'
import type { PeraWalletConnectOptions } from '../clients/pera/types'
import type { DeflyWalletConnectOptions } from '../clients/defly/types'
import type { ExodusOptions } from '../clients/exodus/types'
import type { KmdOptions } from '../clients/kmd/types'
import type { MyAlgoConnectOptions } from '../clients/myalgo/types'
import type { DaffiWalletConnectOptions } from '../clients/daffi/types'
import type { NonEmptyArray } from './utilities'

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
    clientOptions?: Web3ModalSignOptions
    clientStatic?: typeof Web3ModalSign
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

export type NodeConfig = {
  network: Network
  nodeServer: string
  nodeToken?: string
  nodePort?: string | number
  nodeHeaders?: Record<string, string>
}

type ProviderDef =
  | (ProviderConfig<PROVIDER_ID.PERA> & { clientStatic: typeof PeraWalletConnect })
  | (ProviderConfig<PROVIDER_ID.DEFLY> & { clientStatic: typeof DeflyWalletConnect })
  | (ProviderConfig<PROVIDER_ID.DAFFI> & { clientStatic: typeof DaffiWalletConnect })
  | (ProviderConfig<PROVIDER_ID.WALLETCONNECT> & {
      clientStatic: typeof Web3ModalSign
      clientOptions: Web3ModalSignOptions
    })
  | (ProviderConfig<PROVIDER_ID.MYALGO> & { clientStatic: typeof MyAlgoConnect })
  | ProviderConfig<PROVIDER_ID.EXODUS>
  | ProviderConfig<PROVIDER_ID.KMD>
  | PROVIDER_ID.EXODUS
  | PROVIDER_ID.KMD
  | PROVIDER_ID.ALGOSIGNER
  | PROVIDER_ID.MNEMONIC

export type ProviderArray = NonEmptyArray<ProviderDef>
