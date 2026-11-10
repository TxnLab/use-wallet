/**
 * WebAuthn ceremonies.
 *
 * Each function calls `navigator.credentials.*` synchronously, before its
 * first `await`. WebKit (every iOS browser) drops the user gesture across an
 * await, so callers must also start the ceremony before awaiting anything.
 *
 * PRF output depends on whether the user was verified (CTAP2 `hmac-secret`
 * keeps separate secrets for verified and presence-only ceremonies), so every
 * ceremony that evaluates the PRF uses `userVerification: 'required'`. Only
 * `assertUser`, which evaluates nothing, may use `'preferred'`.
 */
import { PasskeyError, toPasskeyError } from './errors'

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

function getCredentials(): CredentialsContainer {
  if (
    typeof navigator === 'undefined' ||
    !navigator.credentials ||
    !globalThis.PublicKeyCredential
  ) {
    throw new PasskeyError('unsupported', 'This browser does not support passkeys.')
  }
  return navigator.credentials
}

/** Copy a WebAuthn buffer so the result doesn't alias the credential object */
function copy(buffer: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  return ArrayBuffer.isView(buffer)
    ? new Uint8Array(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))
    : new Uint8Array(new Uint8Array(buffer))
}

/** Zero a WebAuthn buffer once it's copied, so the credential's results don't keep a secret */
function wipe(buffer: ArrayBuffer | ArrayBufferView): void {
  const view = ArrayBuffer.isView(buffer)
    ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    : new Uint8Array(buffer)
  view.fill(0)
}

export interface CreatePasskeyParams {
  rpId: string
  rpName: string
  userName: string
}

/**
 * Create a discoverable passkey with the PRF extension enabled. Returns its
 * credential ID. The create-time `prf.enabled` flag is unreliable (1Password
 * on iOS returns `{}`, Windows Hello reports `false` but works), so callers
 * confirm PRF support with a scoped `evaluatePrf` right after.
 */
export function createPasskey({
  rpId,
  rpName,
  userName
}: CreatePasskeyParams): Promise<Uint8Array> {
  let pending: Promise<Credential | null>
  try {
    pending = getCredentials().create({
      publicKey: {
        rp: { id: rpId, name: rpName },
        user: { id: randomBytes(16), name: userName, displayName: userName },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -8 }, // EdDSA
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 } // RS256
        ],
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required'
        },
        extensions: { prf: {} }
      }
    })
  } catch (error) {
    return Promise.reject(toPasskeyError(error))
  }

  return pending.then(
    (credential) => {
      if (!(credential instanceof PublicKeyCredential)) {
        throw new PasskeyError('cancelled', 'No passkey was created.')
      }
      return copy(credential.rawId)
    },
    (error) => {
      throw toPasskeyError(error)
    }
  )
}

export interface EvaluatePrfParams {
  rpId: string
  prfInput: Uint8Array
  /**
   * Also evaluate the PRF at this input (`eval.second`), in the same ceremony.
   * Without it the request asks for `eval.first` alone.
   */
  secondInput?: Uint8Array
  /** Scope the ceremony to this credential. Omit to let the user pick a passkey. */
  credentialId?: Uint8Array
}

export interface PrfResult {
  credentialId: Uint8Array
  /** The 32-byte PRF output. Zero it once it's used. */
  prf: Uint8Array
  /**
   * The 32-byte PRF output for `secondInput`, when it was asked for and the
   * provider gave it, and it isn't `prf` over again. Zero it once it's used.
   */
  second?: Uint8Array
}

/** Run a PRF assertion with `userVerification: 'required'` */
export function evaluatePrf({
  rpId,
  prfInput,
  secondInput,
  credentialId
}: EvaluatePrfParams): Promise<PrfResult> {
  let pending: Promise<Credential | null>
  try {
    pending = getCredentials().get({
      publicKey: {
        challenge: randomBytes(32),
        rpId,
        userVerification: 'required',
        allowCredentials: credentialId
          ? [{ type: 'public-key', id: copy(credentialId) }]
          : undefined,
        extensions: {
          prf: {
            eval: secondInput
              ? { first: copy(prfInput), second: copy(secondInput) }
              : { first: copy(prfInput) }
          }
        }
      }
    })
  } catch (error) {
    return Promise.reject(toPasskeyError(error))
  }

  return pending.then(
    (credential) => {
      if (!(credential instanceof PublicKeyCredential)) {
        throw new PasskeyError('cancelled', 'No passkey was selected.')
      }
      const rawId = copy(credential.rawId)
      if (credentialId && !bytesEqual(rawId, credentialId)) {
        throw new PasskeyError('key-mismatch', 'A different passkey answered the request.')
      }
      const results = credential.getClientExtensionResults().prf?.results
      const first = results?.first
      if (!first) {
        throw new PasskeyError(
          'prf-unsupported',
          "This passkey's provider doesn't support the PRF extension. Use a passkey from a provider that does, such as iCloud Keychain, Google Password Manager, 1Password, Windows Hello or a FIDO2 security key."
        )
      }
      // Copy both before wiping either: the results may share a buffer
      const prf = copy(first)
      let second = secondInput && results?.second ? copy(results.second) : undefined
      wipe(first)
      if (results?.second) wipe(results.second)
      if (prf.length !== 32) {
        prf.fill(0)
        second?.fill(0)
        throw new PasskeyError('prf-unsupported', `Unexpected PRF output length: ${prf.length}`)
      }
      // A provider that leaves out the second output still signs in; only the app secret is missing.
      // So is one that answers it with the first: that's the key's entropy, which no app may hold
      if (second && (second.length !== 32 || bytesEqual(second, prf))) {
        second.fill(0)
        second = undefined
      }
      return { credentialId: rawId, prf, second }
    },
    (error) => {
      throw toPasskeyError(error)
    }
  )
}

export interface AssertUserParams {
  rpId: string
  credentialId: Uint8Array
  userVerification: 'preferred' | 'required'
}

/**
 * Run a bare assertion as a consent prompt: no PRF, so it derives nothing and
 * may use `'preferred'`. There is no server to check its signature; it only
 * proves the user approved the prompt on this page.
 */
export function assertUser({
  rpId,
  credentialId,
  userVerification
}: AssertUserParams): Promise<void> {
  let pending: Promise<Credential | null>
  try {
    pending = getCredentials().get({
      publicKey: {
        challenge: randomBytes(32),
        rpId,
        userVerification,
        allowCredentials: [{ type: 'public-key', id: copy(credentialId) }]
      }
    })
  } catch (error) {
    return Promise.reject(toPasskeyError(error))
  }

  return pending.then(
    (credential) => {
      if (!(credential instanceof PublicKeyCredential)) {
        throw new PasskeyError('cancelled', 'The passkey prompt was dismissed.')
      }
    },
    (error) => {
      throw toPasskeyError(error)
    }
  )
}
