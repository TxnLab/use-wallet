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
  /** Scope the ceremony to this credential. Omit to let the user pick a passkey. */
  credentialId?: Uint8Array
}

export interface PrfResult {
  credentialId: Uint8Array
  /** The 32-byte PRF output. Zero it once it's used. */
  prf: Uint8Array
}

/** Run a PRF assertion with `userVerification: 'required'` */
export function evaluatePrf({
  rpId,
  prfInput,
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
        extensions: { prf: { eval: { first: copy(prfInput) } } }
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
      const first = credential.getClientExtensionResults().prf?.results?.first
      if (!first) {
        throw new PasskeyError(
          'prf-unsupported',
          "This passkey's provider doesn't support the PRF extension. Use a passkey from a provider that does, such as iCloud Keychain, Google Password Manager, 1Password, Windows Hello or a FIDO2 security key."
        )
      }
      const prf = copy(first)
      if (prf.length !== 32) {
        prf.fill(0)
        throw new PasskeyError('prf-unsupported', `Unexpected PRF output length: ${prf.length}`)
      }
      return { credentialId: rawId, prf }
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
