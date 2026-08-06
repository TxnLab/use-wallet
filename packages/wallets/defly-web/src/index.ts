import { DeflyWebAdapter } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'defly-web' as const

export function deflyWeb(options?: WalletFactoryOptions): WalletAdapterConfig {
  return {
    id: WALLET_ID,
    metadata: { ...DeflyWebAdapter.defaultMetadata, ...options?.metadata },
    Adapter: DeflyWebAdapter as unknown as WalletAdapterConfig['Adapter'],
    capabilities: { supportedNetworks: ['mainnet', 'testnet'] }
  }
}

export { DeflyWebAdapter }
