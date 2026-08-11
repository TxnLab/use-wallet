import { DeflyAdapter } from './adapter'
import type { DeflyOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'defly' as const

export function defly(options?: DeflyOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...DeflyAdapter.defaultMetadata, ...metadata },
    Adapter: DeflyAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined,
    capabilities: { supportedNetworks: ['mainnet', 'testnet'] }
  }
}

export { DeflyAdapter }
export type { DeflyOptions }
