import algosdk from 'algosdk'
import { base64ToByteArray, byteArrayToBase64 } from 'src/utils'
import type { SignDataScheme } from 'src/wallets/types'

/**
 * The signature fields of a `SignedTransaction`, i.e. everything but `txn`.
 * An account's empty signature is these fields with placeholder signature bytes.
 */
export type EmptySignatureFields = Omit<
  ConstructorParameters<typeof algosdk.SignedTransaction>[0],
  'txn'
>

/**
 * The kind of signature an account authorizes transactions with, named after
 * the `SignedTransaction` field that carries it. `sig` is a single ed25519 key.
 */
export type SignatureType = 'sig' | 'msig' | 'lsig' | 'pqsig'

const SIGNATURE_FIELDS = new Set(['sig', 'msig', 'lsig', 'pqsig', 'sgnr'])

let placeholderTxn: algosdk.Transaction | undefined

/**
 * A throwaway transaction used to carry signature fields through algosdk's
 * `SignedTransaction` codec. Only the signature fields are ever kept.
 */
function getPlaceholderTxn(): algosdk.Transaction {
  placeholderTxn ??= algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
    receiver: algosdk.ALGORAND_ZERO_ADDRESS_STRING,
    amount: 0,
    suggestedParams: {
      fee: 0,
      minFee: 0,
      firstValid: 0,
      lastValid: 0,
      genesisHash: new Uint8Array(32),
      flatFee: true
    }
  })
  return placeholderTxn
}

/**
 * Encodes signature fields as an empty signature: base64 of the canonical
 * msgpack encoding of a `SignedTransaction` with the `txn` field removed.
 *
 * Placeholder bytes that algosdk omits from the canonical encoding (an all-zero
 * ed25519 `sig`, an empty `pqsig.sig`) are dropped, so a single ed25519 key
 * encodes as an empty map (`"gA=="`).
 */
export function encodeEmptySignature(fields: EmptySignatureFields): string {
  const stxn = new algosdk.SignedTransaction({ ...fields, txn: getPlaceholderTxn() })
  const encoded = algosdk.msgpackRawDecodeAsMap(algosdk.encodeMsgpack(stxn)) as Map<string, unknown>
  encoded.delete('txn')
  return byteArrayToBase64(algosdk.msgpackRawEncode(encoded))
}

/**
 * Decodes an empty signature into `SignedTransaction` signature fields.
 *
 * @throws If the value isn't a base64-encoded msgpack map of signature fields
 */
export function decodeEmptySignature(emptySignature: string): EmptySignatureFields {
  const decoded = algosdk.msgpackRawDecodeAsMap(base64ToByteArray(emptySignature))
  if (!(decoded instanceof Map)) {
    throw new Error('Invalid empty signature: expected a msgpack map')
  }

  const keys = [...decoded.keys()]
  const unexpected = keys.filter((key) => typeof key !== 'string' || !SIGNATURE_FIELDS.has(key))
  if (unexpected.length > 0) {
    throw new Error(`Invalid empty signature: unexpected fields ${unexpected.join(', ')}`)
  }
  if (keys.filter((key) => key !== 'sgnr').length > 1) {
    throw new Error('Invalid empty signature: more than one signature field')
  }

  const stxnFields = algosdk.msgpackRawDecodeAsMap(algosdk.encodeMsgpack(getPlaceholderTxn()))
  decoded.set('txn', stxnFields)
  const { sig, msig, lsig, pqsig, sgnr } = algosdk.decodeSignedTransaction(
    algosdk.msgpackRawEncode(decoded)
  )

  return Object.fromEntries(
    Object.entries({ sig, msig, lsig, pqsig, sgnr }).filter(([, value]) => value !== undefined)
  ) as EmptySignatureFields
}

function tryDecodeEmptySignature(
  emptySignature: string | undefined
): EmptySignatureFields | undefined {
  if (emptySignature === undefined) {
    return undefined
  }

  try {
    return decodeEmptySignature(emptySignature)
  } catch {
    return undefined
  }
}

/**
 * Returns the kind of signature an account's empty signature represents, or
 * `undefined` if the account type is unknown or the empty signature can't be
 * decoded.
 */
export function getSignatureType(emptySignature: string | undefined): SignatureType | undefined {
  const fields = tryDecodeEmptySignature(emptySignature)
  if (!fields) return undefined

  if (fields.pqsig) return 'pqsig'
  if (fields.lsig) return 'lsig'
  if (fields.msig) return 'msig'
  return 'sig'
}

/**
 * Returns the ARC-60 scheme for a post-quantum signature's scheme, or
 * `undefined` if ARC-60 doesn't name it.
 */
export function getPQSignDataScheme(
  pqsig: NonNullable<EmptySignatureFields['pqsig']>
): SignDataScheme | undefined {
  if (byteArrayToBase64(pqsig.sch) === byteArrayToBase64(algosdk.FALCON_1024_SCHEME)) {
    return 'falcon-1024-det'
  }
  return undefined
}

/**
 * Returns the ARC-60 `signData` scheme an account signs with, from its empty
 * signature: `ed25519` for a single ed25519 key, `falcon-1024-det` for a
 * Falcon-1024 key. Use it to set a SIWA payload's `type`.
 *
 * Returns `undefined` for accounts that can't sign data (multisig, logic sig),
 * an unknown post-quantum scheme, or an unknown or invalid empty signature.
 */
export function getSignDataScheme(emptySignature: string | undefined): SignDataScheme | undefined {
  const fields = tryDecodeEmptySignature(emptySignature)
  if (!fields) return undefined

  if (fields.pqsig) return getPQSignDataScheme(fields.pqsig)
  if (fields.lsig || fields.msig) return undefined
  return 'ed25519'
}
