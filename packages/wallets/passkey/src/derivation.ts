/**
 * The derivation from a passkey's PRF output to a Falcon-1024 account.
 *
 * ```
 * entropy    = PRF(eval.first = PRF_LABEL_PREFIX + context)    // 32 bytes
 * keygenSeed = SHA-512/256("PQK" || "f1" || entropy)
 * {pk, sk}   = falcon-1024 generateKey(keygenSeed)             // falcon_det1024
 * address    = algosdk.addressFromPQKey(FALCON_1024_SCHEME, pk)
 * phrase     = algosdk.mnemonicFromSeed(entropy)               // 25 words
 * ```
 *
 * The keygen seed matches go-algorand's `algokey pq` (`derivePQKeySeed`),
 * algosdk's `pq25WordMnemonicToSeed`, Lute's Falcon25 accounts, Pera and
 * ARC-76, so the recovery phrase restores the same account in any of them.
 *
 * NEVER CHANGE `PRF_LABEL_PREFIX`: the label is the PRF input, so changing it
 * changes every account derived from it.
 */
import { sha512_256 } from '@noble/hashes/sha2'

/** The PRF input prefix. Frozen: changing it moves every account. */
export const PRF_LABEL_PREFIX = '@txnlab/use-wallet-passkey:falcon-1024:v1:'

/**
 * A `context` may not contain `:`, so a future account slot can be encoded as
 * a `:<n>` suffix without colliding with any slot-0 label.
 */
const CONTEXT_PATTERN = /^[^:]{0,128}$/

export function assertValidContext(context: string): void {
  if (!CONTEXT_PATTERN.test(context)) {
    throw new Error('passkey: `context` must be at most 128 characters and must not contain ":"')
  }
}

/** The PRF input (`eval.first`) for an account context */
export function prfInput(context: string): Uint8Array {
  assertValidContext(context)
  return new TextEncoder().encode(PRF_LABEL_PREFIX + context)
}

// "PQK" || "f1"
const PQK_PREFIX = new Uint8Array([0x50, 0x51, 0x4b, 0x66, 0x31])

/** keygenSeed = SHA-512/256("PQK" || "f1" || entropy) */
export function keygenSeedFromEntropy(entropy: Uint8Array): Uint8Array {
  if (entropy.length !== 32) {
    throw new Error('entropy must be 32 bytes')
  }
  const input = new Uint8Array(PQK_PREFIX.length + entropy.length)
  input.set(PQK_PREFIX)
  input.set(entropy, PQK_PREFIX.length)
  try {
    return sha512_256(input)
  } finally {
    input.fill(0)
  }
}
