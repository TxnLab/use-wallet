import { PROVIDER_ID } from './wallet'
import type { PeraWalletConnect } from '@perawallet/connect'
import type { DeflyWalletConnect } from '@blockshake/defly-connect'
import type { DaffiWalletConnect } from '@daffiwallet/connect'
import type WalletConnect from '@walletconnect/client'
import type MyAlgoConnect from '@randlabs/myalgo-connect'
import QRCodeModal from 'algorand-walletconnect-qrcode-modal'
import { AlgodClientOptions, Network } from './node'
import algosdk from 'algosdk'
import type { PeraWalletConnectOptions } from '../clients/pera/types'
import { DeflyWalletConnectOptions } from '../clients/defly/types'
import { ExodusOptions } from '../clients/exodus/types'
import { KmdOptions } from '../clients/kmd/types'
import { MyAlgoConnectOptions } from '../clients/myalgo/types'
import { WalletConnectOptions } from '../clients/walletconnect/types'
import { DaffiWalletConnectOptions } from '../clients/daffi/types'

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
  nodePort?: string
}
