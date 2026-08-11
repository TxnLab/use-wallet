import { LuteAdapter } from './adapter'
import type { LuteConnectOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'lute' as const

export function lute(options?: LuteConnectOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...LuteAdapter.defaultMetadata, ...metadata },
    Adapter: LuteAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined
  }
}

export { LuteAdapter }
export type { LuteConnectOptions }
