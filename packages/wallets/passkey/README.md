# @txnlab/use-wallet-passkey

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-passkey)](https://www.npmjs.com/package/@txnlab/use-wallet-passkey)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Passkey adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

It derives a **Falcon-1024 (post-quantum) account** from a passkey's WebAuthn PRF output. Users need no extension, app or seed phrase: their passkey provider (iCloud Keychain, Google Password Manager, 1Password, Windows Hello or a FIDO2 security key) stores and syncs the credential.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-passkey
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { passkey } from '@txnlab/use-wallet-passkey'

const manager = new WalletManager({
  wallets: [passkey({ session: true })]
})
```

Show two buttons. A missing passkey and a cancelled prompt raise the same browser error, so the adapter can't choose for the user:

```typescript
await wallet.connect() // Sign in with an existing passkey
await wallet.connect({ create: true }) // Create a passkey (and a new account)
```

Call `connect`, `signTransactions` and `signData` directly from the click handler, before awaiting anything else. Safari and every iOS browser drop the user's tap across an `await`, and the passkey prompt needs it.

### Options

| Option     | Default             |                                                                                                                                              |
| ---------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpId`     | `location.hostname` | The domain the passkey, and so the account, is bound to. Set a parent domain (`example.com`) to share one account across its subdomains.     |
| `rpName`   | the RP ID           | The name shown in passkey prompts                                                                                                            |
| `context`  | `''`                | Separates this app's account from others on the same domain. No `:`; changing it changes the account.                                        |
| `userName` | `<rpName> account`  | The name new passkeys are saved under                                                                                                        |
| `session`  | `false`             | Keep the key unlocked between signatures (see below). `true` or `{ idleTimeoutMs }`; the default timeout is 15 minutes, and `0` disables it. |
| `confirm`  | `() => 'presence'`  | How to confirm each signature while a session is unlocked                                                                                    |
| `keyStore` | built-in worker     | Replace where the key is held (`PasskeyKeyStore`)                                                                                            |

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Sessions and confirmation

Every passkey prompt that derives the key requires full user verification (biometric, PIN or system password), because the PRF output depends on it. Without `session`, every signing request runs one.

With `session`, only the first request after connecting or reloading does. The key then stays in a dedicated worker until the idle timeout, `disconnect` or a page reload, and `confirm` decides how each later request is approved:

- `'silent'`: no prompt
- `'presence'`: a passkey prompt with `userVerification: 'preferred'`, which some providers satisfy with a tap
- `'verify'`: a passkey prompt with full user verification

```typescript
passkey({
  session: { idleTimeoutMs: 10 * 60 * 1000 },
  confirm: (request) =>
    request.type === 'transactions' && request.transactions.some((txn) => txn.type === 'pay')
      ? 'verify'
      : 'presence'
})
```

`confirm` must be synchronous: awaiting before the prompt would lose the user's tap on iOS.

### Recovery phrase

The account is bound to your domain, so it's stranded if the domain is lost. Let users export its recovery phrase:

```typescript
import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

const wallet = manager.getWallet('passkey') as PasskeyAdapter
const { phrase } = await wallet.exportRecoveryPhrase() // fresh passkey prompt, full verification
```

With a framework adapter, get the manager from `useWalletManager()`.

Tell users to **import the phrase as a Falcon / quantum account**: in Lute, Add account → "Falcon25 account" → Import; in Pera, the quantum import; or `algokey pq import --scheme falcon-1024`. The same 25 words in a regular import restore a different, empty account.

### Content Security Policy

The key runs in a module worker started from a `blob:` URL, using WebAssembly. If your page sets a CSP, allow both:

```
script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:
```

Without them, signing fails with a `PasskeyError` whose `code` is `key-store-failed`.

### Errors

Failures throw a `PasskeyError` with a `code`: `cancelled`, `unsupported` (no WebAuthn, or an in-app browser), `prf-unsupported` (the provider lacks the PRF extension; Ledger Stax and Dashlane on Android are known cases), `invalid-rp-id`, `key-mismatch`, `not-connected`, `key-store-failed` or `failed`. `signData` validation failures throw a `SignDataError` with an ARC-60 code.

## Falcon accounts

- Each signed transaction carries a ~3.2 KB `pqsig` and pays an extra 2× the minimum fee. Get fees by simulating with `emptyTransactionSigner` and `allowEmptySignatures`.
- No multisig participation and no raw-bytes or program-data signing.
- `signData` supports ARC-60 authentication with scheme `falcon-1024-det`.

## Security

- **The domain holds the keys.** Whoever controls the RP ID domain (including an XSS on it) can run a passkey prompt and recover the key with one tap.
- **Post-quantum is bounded by the passkey's custody.** The PRF itself is symmetric, but synced passkeys are protected by each provider's classical encryption, and the CTAP2 channel uses P-256. Hardware security keys that don't sync close more of that gap.
- Only public data is stored (credential ID, public key, address). The private key lives in a worker, never on the page's main thread, and is dropped on lock.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
