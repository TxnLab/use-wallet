import { base64ToByteArray, byteArrayToBase64 } from '@txnlab/use-wallet/adapter'

export const LOCAL_STORAGE_PASSKEY_KEY = '@txnlab/use-wallet:v5:passkey'

/**
 * What the adapter persists about a connected passkey account. Public data
 * only: never the PRF output, the entropy or the private key.
 */
export interface PasskeyRecord {
  /** Bumped if the derivation ever changes */
  version: 1
  rpId: string
  context: string
  credentialId: Uint8Array
  publicKey: Uint8Array
  /** The PQ address salt from `addressFromPQKey` */
  salt: number
  address: string
}

interface StoredRecord {
  version: 1
  rpId: string
  context: string
  credentialId: string
  publicKey: string
  salt: number
  address: string
}

export function loadRecord(): PasskeyRecord | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PASSKEY_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<StoredRecord>
    if (
      stored.version !== 1 ||
      typeof stored.rpId !== 'string' ||
      typeof stored.context !== 'string' ||
      typeof stored.credentialId !== 'string' ||
      typeof stored.publicKey !== 'string' ||
      typeof stored.salt !== 'number' ||
      typeof stored.address !== 'string'
    ) {
      return null
    }
    return {
      version: 1,
      rpId: stored.rpId,
      context: stored.context,
      credentialId: base64ToByteArray(stored.credentialId),
      publicKey: base64ToByteArray(stored.publicKey),
      salt: stored.salt,
      address: stored.address
    }
  } catch {
    return null
  }
}

export function saveRecord(record: PasskeyRecord): void {
  if (typeof localStorage === 'undefined') return
  const stored: StoredRecord = {
    ...record,
    credentialId: byteArrayToBase64(record.credentialId),
    publicKey: byteArrayToBase64(record.publicKey)
  }
  localStorage.setItem(LOCAL_STORAGE_PASSKEY_KEY, JSON.stringify(stored))
}

export function removeRecord(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_STORAGE_PASSKEY_KEY)
}
