import { MnemonicAdapter } from './adapter'
import type { MnemonicOptions } from './adapter'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'mnemonic' as const

export function mnemonic(options?: MnemonicOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  return {
    id: WALLET_ID,
    metadata: { ...MnemonicAdapter.defaultMetadata, ...metadata },
    Adapter: MnemonicAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined,
    capabilities: { excludedNetworks: ['mainnet'] }
  }
}

export { MnemonicAdapter }
export type { MnemonicOptions }
