import { W3WalletAdapter } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'w3wallet' as const

export function w3wallet(options?: WalletFactoryOptions): WalletAdapterConfig {
  return {
    id: WALLET_ID,
    metadata: { ...W3WalletAdapter.defaultMetadata, ...options?.metadata },
    Adapter: W3WalletAdapter as unknown as WalletAdapterConfig['Adapter'],
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

export { W3WalletAdapter }
export type { W3WalletProvider } from './adapter'
