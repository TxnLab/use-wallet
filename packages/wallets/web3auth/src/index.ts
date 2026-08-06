import { Web3AuthAdapter } from './adapter'
import type { Web3AuthOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'web3auth' as const

export function web3auth(options: Web3AuthOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options
  return {
    id: WALLET_ID,
    metadata: { ...Web3AuthAdapter.defaultMetadata, ...metadata },
    Adapter: Web3AuthAdapter as unknown as WalletAdapterConfig['Adapter'],
    options: adapterOptions as unknown as Record<string, unknown>,
    capabilities: { supportedNetworks: ['mainnet'] }
  }
}

export { Web3AuthAdapter }
export type { Web3AuthOptions, Web3AuthCustomAuth, Web3AuthCredentials } from './adapter'
