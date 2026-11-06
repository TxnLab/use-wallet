# @txnlab/use-wallet-passkey

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-passkey)](https://www.npmjs.com/package/@txnlab/use-wallet-passkey)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Passkey adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

It derives an **app-scoped Falcon-1024 (post-quantum) account** from a passkey's WebAuthn PRF output. Users need no extension, app or seed phrase: their passkey provider (iCloud Keychain, Google Password Manager, 1Password, Windows Hello or a FIDO2 security key) stores and syncs the credential.

The account belongs to the site that creates it. Read the security model before you ship it.

## Security model

The key is derived inside your page, so your site is part of the account's trust boundary:

- **Your site can take the key.** The passkey only works on its domain (the RP ID), and any script running there can derive the account's key with one verified passkey prompt, which looks the same as signing in. That includes your own code, an XSS bug, a compromised dependency or third-party script, a takeover of your hosting, deploy or DNS accounts, a re-registered domain, and every subdomain when `rpId` is a parent domain.
- **The library can't protect users from the site.** It runs in your page, so nothing in it can stop the site itself from taking the key. Users have to trust your site the way they'd trust an app that holds a balance for them.
- **Other sites can't reach it.** Browsers bind a passkey to its domain, so another site can't derive this account, and this account gives no access to the user's other wallets.
- **An unlocked session signs without a new key prompt.** Page scripts can request signatures through the adapter: silently if `confirm` returns `'silent'`, otherwise behind a passkey prompt. Getting the key itself always takes a fully verified prompt.
- **Post-quantum is bounded by the passkey's custody.** The PRF itself is symmetric, but synced passkeys are protected by each provider's classical encryption, and the CTAP2 channel uses P-256. Hardware security keys that don't sync close more of that gap.
- **Only public data is stored** (credential ID, public key, address). The private key lives in a worker, never on the page's main thread, and is dropped on lock.

Tell users plainly whose account it is, for example: _"This account is created by and for example.com. Keep only what you need here, and move larger amounts to a wallet you control."_ For the same reason, the adapter names the account after its domain (`Passkey · example.com`).

### Best practices

- Present it as a starting account: keep balances small, and offer both [moving to a wallet](#moving-to-a-wallet) and the [recovery phrase](#recovery-phrase).
- Set a strict [Content Security Policy](#content-security-policy) and load as few third-party scripts as you can.
- Keep `rpId` narrow: the default hostname, unless you need to share the account across subdomains.
- Protect the domain and the accounts behind it: registrar lock, auto-renew, and two-factor authentication on your registrar, DNS, hosting and deploy accounts.
- Choose `confirm` and the session timeouts deliberately, or [let users choose](#user-preferences). With `'silent'`, any script on your page can sign while the session is unlocked, so it's exactly as safe as your page. Asking for `'presence'` or `'verify'` above an amount you pick is a middle ground.
- Show what's being signed in your own UI before you call `signTransactions`. The passkey prompt can only show your site's name.

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

| Option     | Default             |                                                                                                                                          |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rpId`     | `location.hostname` | The domain the passkey, and so the account, is bound to. Set a parent domain (`example.com`) to share one account across its subdomains. |
| `rpName`   | the RP ID           | The name shown in passkey prompts                                                                                                        |
| `context`  | `''`                | Separates this app's account from others on the same domain. No `:`; changing it changes the account.                                    |
| `userName` | `<rpName> account`  | The name new passkeys are saved under                                                                                                    |
| `session`  | `false`             | Keep the key unlocked between signatures (see below). `true` or `{ idleTimeoutMs, maxAgeMs, lockWhenHidden }`.                           |
| `confirm`  | `() => 'presence'`  | How to confirm each signature while a session is unlocked                                                                                |
| `onLock`   | none                | Called with a reason when an unlocked session locks (see below)                                                                          |
| `onUnlock` | none                | Called when a locked session unlocks (see below)                                                                                         |
| `keyStore` | built-in worker     | Replace where the key is held (`PasskeyKeyStore`)                                                                                        |

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Sessions and confirmation

Every passkey prompt that derives the key requires full user verification (biometric, PIN or system password), because the PRF output depends on it. Without `session`, every signing request runs one.

With `session`, only the first request after connecting or reloading does. The key then stays in a dedicated worker until the session locks, and `confirm` decides how each later request is approved:

- `'silent'`: no prompt
- `'presence'`: a passkey prompt with `userVerification: 'preferred'`, which some providers satisfy with a tap
- `'verify'`: a passkey prompt with full user verification

A session locks on `disconnect`, on a page reload, and when any of these options says so:

- `idleTimeoutMs`: after this long without a signature. Default: 15 minutes.
- `maxAgeMs`: this long after it unlocked, however active it is. Default: 1 hour.
- `lockWhenHidden`: when the page is hidden, e.g. the user switches tabs or apps. A signing request in progress finishes first. Default: `false`, because on phones, leaving the browser to copy an address means one more verified prompt. Pass a function to follow a setting the user can change.

`0` turns off either timeout.

```typescript
passkey({
  session: { idleTimeoutMs: 10 * 60 * 1000, maxAgeMs: 30 * 60 * 1000, lockWhenHidden: true },
  confirm: (request) =>
    request.type === 'transactions' && request.transactions.some((txn) => txn.type === 'pay')
      ? 'verify'
      : 'presence'
})
```

`confirm` must be synchronous: awaiting before the prompt would lose the user's tap on iOS.

### Unlocking and locking

After a page reload, the first signature runs the PRF ceremony. On iOS, that prompt only appears if `signTransactions` is called straight from the user's tap. If your flow awaits something first, such as fetching a quote or building the group, unlock the session on an earlier tap instead:

```typescript
const wallet = manager.getWallet('passkey') as PasskeyAdapter

wallet.isUnlocked // false after a reload or a lock
await wallet.unlock() // call from a click handler: one verified prompt
wallet.lock() // drops the key; the account stays connected
```

A session can also lock on its own, and a signature can unlock it. Pass `onLock` and `onUnlock` to keep your UI in step, e.g. to show an "Unlock" button:

```typescript
passkey({
  session: true,
  onLock: (reason) => setUnlocked(false), // 'idle' | 'max-age' | 'hidden' | 'lock' | 'disconnect' | 'connect' | 'key-store'
  onUnlock: () => setUnlocked(true)
})
```

`onUnlock` is called once each time a locked session unlocks: on `connect`, `unlock()`, or a signature that ran the PRF ceremony. `onLock` is called once each time it locks: `'idle'` and `'max-age'` are the timeouts, `'hidden'` is `lockWhenHidden`, `'lock'` is your own `lock()` call, `'connect'` means a new `connect` replaced or dropped the session, and `'key-store'` means the key store dropped the key itself, e.g. because its worker failed. Without `session`, neither is called and `unlock()` does nothing.

### User preferences

`confirm` runs on every request, so it can follow a setting the user changes at any time. `lockWhenHidden` can be a function for the same reason. For auto-lock settings, turn off the built-in timeouts and call `lock()` on your own schedule, starting from `onUnlock`:

```typescript
let autoLock: ReturnType<typeof setTimeout> | undefined

passkey({
  session: { idleTimeoutMs: 0, maxAgeMs: 0, lockWhenHidden: () => settings.lockWhenHidden },
  confirm: () => settings.confirmation, // 'silent' | 'presence' | 'verify'
  onUnlock: () => {
    if (settings.autoLockMs) autoLock = setTimeout(() => wallet.lock(), settings.autoLockMs)
  },
  onLock: () => clearTimeout(autoLock)
})
```

These settings decide how often honest requests prompt the user. They don't protect against a compromised page: a script that takes over your page can change them too.

### Recovery phrase

The account is bound to your domain, so it's stranded if the domain is lost. Let users export its recovery phrase:

```typescript
import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

const wallet = manager.getWallet('passkey') as PasskeyAdapter
const { phrase } = await wallet.exportRecoveryPhrase() // fresh passkey prompt, full verification
```

With a framework adapter, get the manager from `useWalletManager()`.

Tell users to **import the phrase as a Falcon / quantum account**: in Lute, Add account → "Falcon25 account" → Import; in Pera, the quantum import; or `algokey pq import --scheme falcon-1024`. The same 25 words in a regular import restore a different, empty account.

### Moving to a wallet

Give users a way to move to a wallet they control, such as Pera, Defly or Lute. After that, a compromise of your site can't reach their funds. There are two ways:

- **Close the account:** send the whole balance to the wallet with `closeRemainderTo`. An account that still holds assets or app opt-ins can't close, so send or opt out of those first, or rekey instead.
- **Rekey it:** keep the address, and give its signing authority to the wallet's account with `rekeyTo`. The passkey can no longer sign for it, so disconnect the passkey account afterwards. The user needs a wallet that supports rekeyed accounts to use the address. Rekeying to a regular (ed25519) account gives up post-quantum protection.

```typescript
import algosdk from 'algosdk'

const wallet = manager.getWallet('passkey')!
const sender = wallet.activeAddress!
const params = await manager.algodClient.getTransactionParams().do()
// A Falcon signature pays 3× the minimum fee; under congestion, simulate for the fee
const suggestedParams = { ...params, flatFee: true, fee: params.minFee * 3n }

// Close: send the whole balance to the wallet
const close = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  sender,
  receiver: walletAddress,
  amount: 0,
  closeRemainderTo: walletAddress,
  suggestedParams
})

// Or rekey: keep the address, and let the wallet sign for it
const rekey = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
  sender,
  receiver: sender,
  amount: 0,
  rekeyTo: walletAddress,
  suggestedParams
})

const [signed] = await wallet.signTransactions([close]) // or [rekey]
await manager.algodClient.sendRawTransaction(signed!).do()
```

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

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
