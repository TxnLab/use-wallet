import { PasskeyAdapter } from './adapter'
import type {
  PasskeyConfirmation,
  PasskeyConnectArgs,
  PasskeyLockReason,
  PasskeyOptions,
  PasskeyRecoveryPhrase,
  PasskeySessionOptions,
  PasskeySigningRequest
} from './adapter'
import { assertValidContext } from './derivation'
import type { WalletAdapterConfig, WalletFactoryOptions } from '@txnlab/use-wallet'

export const WALLET_ID = 'passkey' as const

export function passkey(options?: PasskeyOptions & WalletFactoryOptions): WalletAdapterConfig {
  const { metadata, ...adapterOptions } = options ?? {}
  assertValidContext(adapterOptions.context ?? '')
  return {
    id: WALLET_ID,
    metadata: { ...PasskeyAdapter.defaultMetadata, ...metadata },
    Adapter: PasskeyAdapter as unknown as WalletAdapterConfig['Adapter'],
    options:
      Object.keys(adapterOptions).length > 0
        ? (adapterOptions as unknown as Record<string, unknown>)
        : undefined
  }
}

export { PasskeyAdapter }
export { PasskeyError, type PasskeyErrorCode } from './errors'
export {
  WorkerKeyStore,
  type PasskeyKeyStore,
  type WorkerKeyStoreLockReason,
  type WorkerKeyStoreOptions
} from './key-store'
export type { PasskeyTimeoutReason } from './worker/protocol'
export { PRF_LABEL_PREFIX, keygenSeedFromEntropy, prfInput } from './derivation'
export { LOCAL_STORAGE_PASSKEY_KEY } from './record'
export type {
  PasskeyConfirmation,
  PasskeyConnectArgs,
  PasskeyLockReason,
  PasskeyOptions,
  PasskeyRecoveryPhrase,
  PasskeySessionOptions,
  PasskeySigningRequest
}
