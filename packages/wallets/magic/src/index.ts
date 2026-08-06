import { MagicAdapter } from './adapter'
import type { MagicAuthOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'magic' as const

export function magic(options?: MagicAuthOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...MagicAdapter.defaultMetadata, ...metadata },
    Adapter: MagicAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined,
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

export { MagicAdapter }
export type { MagicAuthOptions, MagicAuthClient } from './adapter'
