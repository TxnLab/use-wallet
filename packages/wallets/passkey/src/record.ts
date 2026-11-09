import algosdk from 'algosdk'
import { base64ToByteArray, byteArrayToBase64 } from '@txnlab/use-wallet/adapter'

export const LOCAL_STORAGE_PASSKEY_KEY = '@txnlab/use-wallet:v5:passkey'

/** An account rekeyed to the passkey account on one network */
export interface RekeyedAccount {
  /** The account's address, in canonical form */
  address: string
  /** The network: its genesis hash, or its network ID when its config has none */
  network: string
}

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
  /** Accounts rekeyed to `address`, in the order they were added */
  rekeyedAccounts: RekeyedAccount[]
}

interface StoredRecord {
  version: 1
  rpId: string
  context: string
  credentialId: string
  publicKey: string
  salt: number
  address: string
  /** Absent in records saved before rekeyed accounts, and when there are none */
  rekeyedAccounts?: RekeyedAccount[]
}

/** The canonical form of an address, or `undefined` if it isn't one */
export function canonicalAddress(address: unknown): string | undefined {
  if (typeof address !== 'string') return undefined
  try {
    // Decoding drops the padding bits a valid address can still set in its last character
    return algosdk.Address.fromString(address).toString()
  } catch {
    return undefined
  }
}

/**
 * The stored rekeyed accounts that are well formed, canonicalized and without
 * duplicates. A bad entry is dropped rather than failing the record: the
 * entries only say which accounts to list, and the network decides which
 * key controls each one.
 */
function loadRekeyedAccounts(stored: unknown, ownAddress: string): RekeyedAccount[] {
  if (!Array.isArray(stored)) return []
  const accounts: RekeyedAccount[] = []
  for (const entry of stored) {
    if (!entry || typeof entry !== 'object' || typeof entry.network !== 'string') continue
    const address = canonicalAddress(entry.address)
    if (!address || address === ownAddress) continue
    if (accounts.some((a) => a.address === address && a.network === entry.network)) continue
    accounts.push({ address, network: entry.network })
  }
  return accounts
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
      address: stored.address,
      rekeyedAccounts: loadRekeyedAccounts(stored.rekeyedAccounts, stored.address)
    }
  } catch {
    return null
  }
}

export function saveRecord(record: PasskeyRecord): void {
  if (typeof localStorage === 'undefined') return
  const { rekeyedAccounts, ...rest } = record
  const stored: StoredRecord = {
    ...rest,
    credentialId: byteArrayToBase64(record.credentialId),
    publicKey: byteArrayToBase64(record.publicKey),
    // Records without rekeyed accounts keep their original format
    ...(rekeyedAccounts.length > 0 && { rekeyedAccounts })
  }
  localStorage.setItem(LOCAL_STORAGE_PASSKEY_KEY, JSON.stringify(stored))
}

export function removeRecord(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_STORAGE_PASSKEY_KEY)
}
