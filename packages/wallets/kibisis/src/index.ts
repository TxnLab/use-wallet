import { KibisisAdapter } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'kibisis' as const

export function kibisis(options?: WalletFactoryOptions): WalletAdapterConfig {
  return {
    id: WALLET_ID,
    metadata: { ...KibisisAdapter.defaultMetadata, ...options?.metadata },
    Adapter: KibisisAdapter as unknown as WalletAdapterConfig['Adapter']
  }
}

export { KibisisAdapter }
