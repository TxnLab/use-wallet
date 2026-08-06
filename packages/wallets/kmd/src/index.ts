import { KmdAdapter } from './adapter'
import type { KmdOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'kmd' as const

export function kmd(options?: KmdOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...KmdAdapter.defaultMetadata, ...metadata },
    Adapter: KmdAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined
  }
}

export { KmdAdapter }
export type { KmdOptions }
