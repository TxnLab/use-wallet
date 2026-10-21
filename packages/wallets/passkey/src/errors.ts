export type PasskeyErrorCode =
  /** The user cancelled or the request timed out (or, on iOS, an in-app browser blocked it) */
  | 'cancelled'
  /** This browser can't run passkey ceremonies (no WebAuthn, or an Android WebView) */
  | 'unsupported'
  /** The passkey's provider doesn't support the PRF extension */
  | 'prf-unsupported'
  /** The relying party ID isn't valid for this page's origin */
  | 'invalid-rp-id'
  /** The passkey derived a different key than the connected account's */
  | 'key-mismatch'
  /** No account is connected */
  | 'not-connected'
  /** The key store failed, e.g. the session worker was blocked by a CSP */
  | 'key-store-failed'
  | 'failed'

export class PasskeyError extends Error {
  readonly code: PasskeyErrorCode

  constructor(code: PasskeyErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PasskeyError'
    this.code = code
  }
}

/**
 * Classifies a WebAuthn failure after the fact. Never gate on user-agent
 * sniffing up front: these errors are the only reliable signal.
 */
export function toPasskeyError(error: unknown): PasskeyError {
  if (error instanceof PasskeyError) return error

  const name = error instanceof Error ? error.name : undefined
  const message = error instanceof Error ? error.message : String(error)

  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return new PasskeyError(
        'cancelled',
        'The passkey request was cancelled or timed out. In an in-app browser, open the page in Safari or Chrome.',
        { cause: error }
      )
    case 'NotSupportedError':
      // Android WebView: "...connecting to Web Authentication service"
      return new PasskeyError(
        'unsupported',
        'This browser does not support passkeys here. Open the page in a full browser.',
        { cause: error }
      )
    case 'SecurityError':
      return new PasskeyError(
        'invalid-rp-id',
        `The passkey relying party ID is not valid for this origin: ${message}`,
        { cause: error }
      )
    default:
      return new PasskeyError('failed', message, { cause: error })
  }
}
