import { PeraAdapter } from './adapter'
import type { PeraOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'pera' as const

export function pera(options?: PeraOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...PeraAdapter.defaultMetadata, ...metadata },
    Adapter: PeraAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined,
    capabilities: { supportedNetworks: ['mainnet', 'testnet'] }
  }
}

export { PeraAdapter }
export type { PeraOptions }
