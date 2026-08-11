import { ExodusAdapter } from './adapter'
import type { ExodusOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'exodus' as const

export function exodus(options?: ExodusOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...ExodusAdapter.defaultMetadata, ...metadata },
    Adapter: ExodusAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined,
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

export { ExodusAdapter }
export type { ExodusOptions }
