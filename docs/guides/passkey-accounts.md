---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# Passkey Accounts

The Passkey adapter (`@txnlab/use-wallet-passkey`) gives users an Algorand account from a passkey, with no extension, app or seed phrase to set up. The user's passkey provider (iCloud Keychain, Google Password Manager, 1Password, Windows Hello or a FIDO2 security key) stores and syncs the passkey, and approves each sensitive step with a biometric, PIN or system password.

The account is a **Falcon-1024 (post-quantum)** account. Its key is derived from the passkey's WebAuthn PRF output, so the same passkey gives the same account on every device it syncs to.

{% hint style="warning" %}
**The account belongs to your site.** The key is derived inside your page, so any script running on your domain can reach it with one passkey prompt that looks like a sign-in. Users have to trust your site the way they'd trust an app that holds a balance for them. Read the [security model](#security-model) before you ship it.
{% endhint %}

### How It Works

* **Creating an account** saves a new passkey for your domain, then asks it for a PRF output for a label set by the adapter and your `context`. That 32-byte output is the account's secret: it seeds the Falcon key, and its 25-word encoding is the account's recovery phrase.
* **Signing in** asks an existing passkey for the same output. The same passkey on the same domain always derives the same account.
* **Every prompt that derives the key requires full user verification**, because the PRF output depends on it.
* **The private key lives in a dedicated worker**, never on the page's main thread, and is dropped when the session locks. Only public data is stored: the credential ID, the public key and the address, and the addresses and networks of [rekeyed accounts](#rekeyed-accounts).

### Security Model

The key is derived inside your page, so your site is part of the account's trust boundary.

* **Your site can take the key.** The passkey only works on its domain (the relying party ID), and any script running there can derive the account's key with one verified passkey prompt. That includes your own code, an XSS bug, a compromised dependency or third-party script, a takeover of your hosting, deploy or DNS accounts, a re-registered domain, and every subdomain when `rpId` is a parent domain.
* **The library can't protect users from the site.** It runs in your page, so nothing in it can stop the site itself from taking the key.
* **Other sites can't reach it.** Browsers bind a passkey to its domain, so another site can't derive this account, and this account gives no access to the user's other wallets.
* **An unlocked session signs without a new key prompt.** Page scripts can request signatures through the adapter: silently if `confirm` returns `'silent'`, otherwise behind a passkey prompt. Getting the key itself always takes a fully verified prompt.
* **Post-quantum is bounded by the passkey's custody.** The PRF itself is symmetric, but synced passkeys are protected by each provider's classical encryption, and the CTAP2 channel uses P-256. Hardware security keys that don't sync close more of that gap.

Tell users plainly whose account it is, for example: _"This account is created by and for example.com. Keep only what you need here, and move larger amounts to a wallet you control."_ For the same reason, the adapter names the account after its domain (`Passkey · example.com`).

#### Best Practices

* Present it as a starting account: keep balances small, and offer both [moving to a wallet](#moving-to-a-wallet) and the [recovery phrase](#recovery-phrase).
* Set a strict [Content Security Policy](#content-security-policy) and load as few third-party scripts as you can.
* Keep `rpId` narrow: the default hostname, unless you need to share the account across subdomains.
* Protect the domain and the accounts behind it: registrar lock, auto-renew, and two-factor authentication on your registrar, DNS, hosting and deploy accounts.
* Choose `confirm` and the session timeouts deliberately, or [let users choose](#user-preferences). With `'silent'`, any script on your page can sign while the session is unlocked, so it's exactly as safe as your page. Asking for `'presence'` or `'verify'` above an amount you pick is a middle ground.
* Show what's being signed in your own UI before you call `signTransactions`. The passkey prompt can only show your site's name.

### Installation

```bash
npm install @txnlab/use-wallet-passkey
```

Install it next to `@txnlab/use-wallet` or your framework adapter, at the same version.

### Configuration

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { passkey } from '@txnlab/use-wallet-passkey'

const manager = new WalletManager({
  wallets: [passkey({ rpName: 'My dApp', session: true })]
})
```

| Option     | Default             | Description                                                                                                                              |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `rpId`     | `location.hostname` | The domain the passkey, and so the account, is bound to. Set a parent domain (`example.com`) to share one account across its subdomains. |
| `rpName`   | the RP ID           | The name shown in passkey prompts                                                                                                        |
| `context`  | `''`                | Separates this app's account from others on the same domain. No `:`; changing it changes the account.                                    |
| `userName` | `<rpName> account`  | The name new passkeys are saved under in the user's password manager                                                                     |
| `session`  | `false`             | Keep the key unlocked between signatures. `true` or `{ idleTimeoutMs, maxAgeMs, lockWhenHidden }`. See [Sessions](#sessions).            |
| `confirm`  | `() => 'presence'`  | How to confirm each signature while a session is unlocked                                                                                |
| `onLock`   | none                | Called with a reason when an unlocked session locks                                                                                      |
| `onUnlock` | none                | Called when a locked session unlocks                                                                                                     |
| `keyStore` | built-in worker     | Replace where the key is held (`PasskeyKeyStore`)                                                                                        |
| `appSecret` | none               | `{ label }`: also give the app a 32-byte secret of its own (v5.4.0+). See [App Secret](#app-secret).                                    |

The factory also accepts the usual `metadata` option to override the wallet's display name and icon.

{% hint style="info" %}
**The account depends on `rpId` and `context`.** Changing either one gives every user a different, empty account, so pick them once.
{% endhint %}

### Connecting

Show two buttons: **Create passkey** and **Sign in**. A missing passkey and a cancelled prompt raise the same browser error, so the adapter can't choose for the user.

Call `connect`, `unlock`, `signTransactions` and `signData` directly from the click handler, before awaiting anything else. Safari and every iOS browser drop the user's tap across an `await`, and the passkey prompt needs it.

Adapter-specific methods such as `unlock()` aren't on the `useWallet` wallet objects, so get the adapter from [`useWalletManager`](../api-reference/usewalletmanager.md):

{% tabs %}
{% tab title="React" %}
```tsx
import { useWalletManager } from '@txnlab/use-wallet-react'
import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

function PasskeyButtons() {
  const manager = useWalletManager()
  const passkey = () => manager.getWallet('passkey') as PasskeyAdapter | undefined

  return (
    <>
      <button onClick={() => passkey()?.connect({ create: true })}>Create passkey</button>
      <button onClick={() => passkey()?.connect()}>Sign in</button>
      <button onClick={() => passkey()?.unlock()}>Unlock</button>
    </>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  import { useWalletManager } from '@txnlab/use-wallet-vue'
  import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

  const manager = useWalletManager()
  const passkey = () => manager.getWallet('passkey') as PasskeyAdapter | undefined
</script>

<template>
  <button @click="passkey()?.connect({ create: true })">Create passkey</button>
  <button @click="passkey()?.connect()">Sign in</button>
  <button @click="passkey()?.unlock()">Unlock</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWalletManager } from '@txnlab/use-wallet-solid'
import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

function PasskeyButtons() {
  const manager = useWalletManager()
  const passkey = () => manager.getWallet('passkey') as PasskeyAdapter | undefined

  return (
    <>
      <button onClick={() => passkey()?.connect({ create: true })}>Create passkey</button>
      <button onClick={() => passkey()?.connect()}>Sign in</button>
      <button onClick={() => passkey()?.unlock()}>Unlock</button>
    </>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  import { useWalletManager } from '@txnlab/use-wallet-svelte'
  import type { PasskeyAdapter } from '@txnlab/use-wallet-passkey'

  const manager = useWalletManager()
  const passkey = () => manager.getWallet('passkey') as PasskeyAdapter | undefined
</script>

<button onclick={() => passkey()?.connect({ create: true })}>Create passkey</button>
<button onclick={() => passkey()?.connect()}>Sign in</button>
<button onclick={() => passkey()?.unlock()}>Unlock</button>
```
{% endtab %}
{% endtabs %}

To save new passkeys under a name the user chooses, pass it when creating: `connect({ create: true, userName: 'Alice (trading)' })`. Each passkey is a separate account, and the passkey picker shows only these names, so a recognizable name helps users with more than one.

### Sessions

Without `session`, every signing request runs a fully verified passkey prompt that derives the key, signs and drops it.

With `session`, only the first request after connecting or reloading does. The key then stays in a dedicated worker until the session locks, and `confirm` decides how each later request is approved:

* `'silent'`: no prompt
* `'presence'`: a passkey prompt with `userVerification: 'preferred'`, which some providers satisfy with a tap
* `'verify'`: a passkey prompt with full user verification

A session locks on `disconnect`, on a page reload, and when any of these options says so:

* `idleTimeoutMs`: after this long without a signature. Default: 15 minutes.
* `maxAgeMs`: this long after it unlocked, however active it is. Default: 1 hour.
* `lockWhenHidden`: when the page is hidden, e.g. the user switches tabs or apps. A signing request in progress finishes first. Default: `false`, because on phones, leaving the browser to copy an address means one more verified prompt.

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

#### Unlocking and Locking

After a page reload, the first signature runs the verified prompt that derives the key. On iOS, that prompt only appears if `signTransactions` is called straight from the user's tap. If your flow awaits something first, such as fetching a quote or building a group, unlock the session on an earlier tap instead:

```typescript
wallet.isUnlocked // false after a reload or a lock
await wallet.unlock() // call from a click handler: one verified prompt
wallet.lock() // drops the key; the account stays connected
```

A session can also lock on its own, and a signature can unlock it. Pass `onLock` and `onUnlock` to keep your UI in step, e.g. to show an "Unlock" button:

```typescript
passkey({
  session: true,
  onLock: (reason) => setUnlocked(false),
  onUnlock: () => setUnlocked(true)
})
```

`onUnlock` is called once each time a locked session unlocks: on `connect`, `unlock()`, or a signature that derived the key. `onLock` is called once each time it locks, with a reason:

| Reason       | Cause                                                       |
| ------------ | ----------------------------------------------------------- |
| `idle`       | `idleTimeoutMs` passed without a signature                  |
| `max-age`    | `maxAgeMs` passed since the session unlocked                |
| `hidden`     | the page was hidden, with `lockWhenHidden`                  |
| `lock`       | your code called `lock()`                                   |
| `disconnect` | the wallet disconnected                                     |
| `connect`    | a new `connect` replaced or dropped the session             |
| `key-store`  | the key store dropped the key itself, e.g. its worker failed |

Without `session`, neither callback is called and `unlock()` does nothing.

#### User Preferences

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

The [React example](https://github.com/TxnLab/use-wallet/tree/main/examples/react) has a complete session panel: lock status, Unlock and Lock buttons, and settings for confirmation, auto-lock and locking when the tab is hidden.

### Signing

Passkey accounts sign through the usual [`signTransactions`](signing-transactions.md) and [`signData`](signing-data.md) methods, with a few differences that come from Falcon-1024:

* Accounts [rekeyed to the passkey account](#rekeyed-accounts) sign through the same methods (v5.3.0+).
* Each signed transaction carries a ~3.2 KB `pqsig` and pays an extra 2× the minimum fee, including those of rekeyed accounts. Get fees by simulating with `emptyTransactionSigner` and `allowEmptySignatures`.
* `signData` supports ARC-60 authentication with scheme `falcon-1024-det`, for the passkey account and its rekeyed accounts.
* No multisig participation, and no raw-bytes or program-data signing.

### Recovery Phrase

Users can export the account's 25-word recovery phrase with `exportRecoveryPhrase()`, and you should offer it: the account is bound to your domain, so it's stranded if the domain is lost. Each export runs a fresh, fully verified passkey prompt, and returns `{ scheme: 'falcon-1024', phrase }`:

```typescript
const { phrase } = await wallet.exportRecoveryPhrase()
```

{% hint style="warning" %}
**Tell users to import the phrase as a Falcon / quantum account:** in Lute, Add account → "Falcon25 account" → Import; in Pera, the quantum import; or `algokey pq import --scheme falcon-1024`. The same 25 words in a regular import restore a different, empty account.
{% endhint %}

The phrase restores the passkey's key, so it also controls every [account rekeyed to it](#rekeyed-accounts).

For a ready-made UI, the `passkeyPlugin` in [use-wallet-ui](https://github.com/TxnLab/use-wallet-ui) adds recovery phrase export, session lock status with Unlock and Lock, and a note on whose account it is. See the [React](https://github.com/TxnLab/use-wallet-ui/tree/main/examples/react-passkey) and [Vue](https://github.com/TxnLab/use-wallet-ui/tree/main/examples/vue-passkey) passkey examples.

### Moving to a Wallet

Give users a way to move to a wallet they control, such as Pera or Lute. After that, a compromise of your site can't reach their funds. There are two ways:

* **Close the account:** send the whole balance to the wallet with `closeRemainderTo`. An account that still holds assets or app opt-ins can't close, so send or opt out of those first, or rekey instead.
* **Rekey it:** keep the address, and give its signing authority to the wallet's account with `rekeyTo`. The passkey can no longer sign for it, so disconnect the passkey account afterwards: until then, signing still runs a passkey prompt, and the network rejects the result. To use the address, the user needs a wallet that supports both Falcon accounts and rekeyed accounts. Rekeying to a regular (ed25519) account gives up post-quantum protection, and its transactions pay the regular fee again.

{% hint style="warning" %}
**Move the [rekeyed accounts](#rekeyed-accounts) first.** Rekeying or closing the passkey account doesn't move the accounts rekeyed to it: their auth address is still the passkey address, so the passkey's key, and so your site, still controls them. Rekey each one to the wallet's account first (the passkey signs that), then call `removeRekeyedAccount`.
{% endhint %}

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

// Sign from the user's tap, after building the transaction: on iOS, an await
// before the passkey prompt loses the tap (or unlock() first)
const [signed] = await wallet.signTransactions([close]) // or [rekey]
await manager.algodClient.sendRawTransaction(signed!).do()
```

### Rekeyed Accounts

An existing account can move onto the passkey by rekeying to the passkey account. It keeps its address, history and holdings, and the passkey's key signs for it from then on, e.g. to move users off an ed25519 account your site manages for them.

{% hint style="info" %}
**Requires v5.3.0 or later.** Earlier versions sign only for the passkey account's own address, so don't rekey accounts to a passkey account on them.
{% endhint %}

The passkey signs only for the rekeyed accounts your app adds with [`addRekeyedAccount`](#adding-and-removing-rekeyed-accounts), plus the proof transaction in the [rekey group](#rekeying-an-account-to-the-passkey). The adapter doesn't [find them](#finding-rekeyed-accounts), and skips an account rekeyed to the passkey that your app hasn't added. The account's auth address must be the passkey address itself: the passkey can't sign as one key of a multisig.

{% hint style="warning" %}
**A rekeyed account joins the passkey account's [security model](#security-model).** Your site can reach it with the same key, and the [recovery phrase](#recovery-phrase) controls it too.
{% endhint %}

Each transaction the passkey signs for a rekeyed account pays 3× the minimum fee, like the passkey account's own.

#### Rekeying an Account to the Passkey

Rekey in an atomic group with a proof transaction, so the account can only move to a key the user holds:

1. The account pays itself 0 with `rekeyTo` set to the passkey address, signed by the account's current key.
2. The account pays itself 0 again, signed by the passkey. If the passkey doesn't sign it, the whole group fails and the account stays where it was.

`signTransactions` signs the second one because the transaction before it rekeys its sender to the passkey account:

```typescript
import algosdk from 'algosdk'
import { PasskeyError, type PasskeyAdapter } from '@txnlab/use-wallet-passkey'

const passkey = (manager.getWallet('passkey') as PasskeyAdapter | undefined)!
const current = manager.getWallet('web3auth')! // the account's current wallet
const account = current.activeAddress!

const params = await manager.algodClient.getTransactionParams().do()
const pay = (fee: bigint, rekeyTo?: string) =>
  algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account,
    receiver: account,
    amount: 0,
    rekeyTo,
    suggestedParams: { ...params, flatFee: true, fee }
  })
const group = algosdk.assignGroupID([
  pay(params.minFee, passkey.passkeyAddress!), // the rekey, signed by the account's key
  pay(params.minFee * 3n) // the proof, signed by the passkey (a Falcon signature pays 3×)
])

// Sign from the user's tap, the passkey first: on iOS, an await before its prompt loses the tap
const [proof] = await passkey.signTransactions(group, [1])
const [rekey] = await current.signTransactions(group, [0])
const { txid } = await manager.algodClient.sendRawTransaction([rekey!, proof!]).do()
await algosdk.waitForConfirmation(manager.algodClient, txid, 4)

// An algod node can lag a round behind the confirmation: retry briefly on `not-rekeyed`
for (let attempt = 1; ; attempt++) {
  try {
    await passkey.addRekeyedAccount(account)
    break
  } catch (error) {
    const lagging = error instanceof PasskeyError && error.code === 'not-rekeyed'
    if (!lagging || attempt === 5) throw error
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
```

`passkeyAddress` is the passkey account's own address, whichever account is active.

`signTransactions` signs a transaction when the passkey's key authorizes its sender at that point in its group: the passkey account, a rekeyed account added with `addRekeyedAccount`, or an account that an earlier transaction in the same group (the same group ID) rekeys to the passkey account. A rekey outside the transaction's group doesn't count. A transaction from any other account is skipped, and so is one whose sender an earlier transaction in its group rekeys elsewhere. Each transaction whose sender isn't the passkey account names the passkey address as its signer (`sgnr`).

#### Adding and Removing Rekeyed Accounts

`addRekeyedAccount(address)` reads the account from algod, and throws a `PasskeyError` with code `not-rekeyed` unless its auth address is the passkey address (or `failed` if algod can't be read). The account then joins the wallet's accounts as `Passkey · rekeyed` and stays across reloads. The active account doesn't change, so call `setActiveAccount` to switch to it. Adding an account again checks it again and returns it.

A rekey belongs to one network, so each rekeyed account is recorded for the network it was added on (by genesis hash, or by network ID for a network without one, like LocalNet). The wallet lists the active network's rekeyed accounts, and lists another network's when the app switches to it. A check on one network never drops an account recorded on another.

`removeRekeyedAccount(address)` stops listing and signing for it on the active network. If it was the active account, the passkey account becomes active. It doesn't change the account on chain: the account stays rekeyed to the passkey account, so the passkey's key still controls it until it's rekeyed elsewhere. `disconnect` drops them all.

On each reload, sign-in with the same passkey, and network switch, the adapter checks the active network's rekeyed accounts with algod in the background: it drops one whose auth address has changed, and keeps them if algod can't be reached. Signing in again with the same passkey while connected keeps the active account; after a disconnect, the passkey account is active.

Right after a rekey, the node an app reads may not show it yet. The manager's check of empty signatures and `signData` both wait a few seconds for algod to show a rekey that an account's empty signature names (`sgnr`) before treating the account as not authorized by the passkey.

#### Finding Rekeyed Accounts

The adapter doesn't search for rekeyed accounts. When a user signs in on another device, or after site data is cleared, you can search an indexer for the accounts whose auth address is the passkey address.

{% hint style="warning" %}
**Anyone can rekey an account to the passkey address**, e.g. a spam account holding fake assets, and `addRekeyedAccount` accepts it. Add only accounts you know are the user's, such as one they just migrated or one your backend has on record for them, or show the others as unverified until the user confirms them.
{% endhint %}

```typescript
const indexer = new algosdk.Indexer('', 'https://mainnet-idx.4160.nodely.dev', '')
// One page holds up to 100 accounts; follow `nextToken` for more
const { accounts } = await indexer.searchAccounts().authAddr(passkey.passkeyAddress!).do()
for (const { address } of accounts) {
  if (knownAccounts.has(address)) await passkey.addRekeyedAccount(address)
}
```

#### Fees and Signing In

* Get fees by simulating with `emptyTransactionSigner` and `allowEmptySignatures`: a rekeyed account's empty signature carries the passkey's key and names the passkey address as `sgnr`. The proof transaction's sender isn't one of the passkey's accounts until the rekey confirms, so give it the 3× fee yourself, as above.
* `signData` accepts an ARC-60 request whose `account_address` is a rekeyed account, with `type: 'falcon-1024-det'`. The signer is the passkey's public key: verify it against the account's auth address, as [Signing Data](signing-data.md) describes.

### App Secret

Some apps need keys besides the Falcon account, e.g. an ed25519 account that signs raw bytes for a service, or an HD wallet. With `appSecret`, the passkey gives the app a 32-byte secret for them: the PRF's second output (`eval.second`, input `APP_SECRET_PREFIX + label`), asked for in the same ceremony that unlocks the key, so it adds no prompt. It's key material, not a key of one kind: see [Deriving Keys from the Secret](#deriving-keys-from-the-secret).

{% hint style="info" %}
**Requires v5.4.0 or later.**
{% endhint %}

```typescript
passkey({ session: true, appSecret: { label: 'my-app/keys' } })

// While the session is unlocked: confirmed per `confirm`, with { type: 'app-secret' }
// While it's locked: one PRF ceremony, so call it from the click handler
const seed = await wallet.withAppSecret(async (secret) => hkdf(secret, 'my-app/payer/v1'))
```

`withAppSecret(callback)` calls `callback` with the secret and returns what `callback` returns. Keep only what you derive: the bytes are zeroed once `callback` settles.

* It's the same on every device the passkey syncs to, and only on this RP ID, like the account.
* It's independent of the account's key and recovery phrase: neither reveals the other. Nothing recovers it without the passkey, so back up whatever depends on it some other way.
* The label is 1 to 128 characters of printable ASCII, with no `:`. Set it as a constant: changing it changes the secret.
* One passkey has one secret per label, shared by its own account and its [rekeyed accounts](#rekeyed-accounts). Derive per account (e.g. with the address in the HKDF info) if each needs its own. `context` isn't part of it: adapters on the same RP ID that use the same label get the same secret.
* Unlike the Falcon key, which stays in its worker, it's held on the main thread while the session is unlocked, so any script on the page can get it through `withAppSecret` then (subject to `confirm`). It's never persisted, and dropped (zeroed) whenever the adapter sees the key lock. A custom `keyStore` that locks itself can't tell the adapter, so the secret stays in memory until the next request or `lock()`, though it's never handed out while the key store is locked. After a reload, a custom key store that kept its key still needs one PRF ceremony for the secret. The bytes passed to the callback are a copy, zeroed once it settles.
* `confirm` receives `{ type: 'app-secret' }` for it: an exhaustive `switch` over `PasskeySigningRequest` needs that case.
* Without the option, ceremonies ask for `eval.first` alone, exactly as before. The account never changes, whatever the label.
* A provider that leaves out the second output still signs in; `withAppSecret` then throws `app-secret-unavailable`. So does one that gives the first output for the second: that is the key's own entropy, which the adapter never hands out.
* If the session locks while a request waits, e.g. on a timeout or `lock()` while the prompt is open, `withAppSecret` throws `failed`, and a retry can succeed.

#### Deriving Keys from the Secret

Derive each key with HKDF, under an `info` string of its own, so one secret gives any number of unrelated keys:

```typescript
async function hkdf(secret: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: new TextEncoder().encode(info) },
    key,
    length * 8
  )
  return new Uint8Array(bits)
}
```

Like the label, an `info` string is fixed once a key derived with it holds anything: changing it changes the key.

**One ed25519 account**, e.g. one that signs raw bytes for a service:

```typescript
const account = await wallet.withAppSecret(async (secret) => {
  const seed = await hkdf(secret, 'my-app/payer/v1')
  try {
    return algosdk.mnemonicToSecretKey(algosdk.mnemonicFromSeed(seed))
  } finally {
    seed.fill(0)
  }
})
```

`algosdk.mnemonicFromSeed(seed)` is the account's 25-word phrase, which any Algorand wallet imports as a regular account.

**An HD wallet** (xHD, ARC-52): any number of ed25519 accounts from one root. 32 bytes are the entropy of a 24-word BIP-39 phrase, and the phrase gives the root key:

```typescript
import * as bip39 from 'bip39'
import { KeyContext, XHDWalletAPI, fromSeed } from '@algorandfoundation/xhd-wallet-api'

const phrase = await wallet.withAppSecret(async (secret) => {
  const entropy = await hkdf(secret, 'my-app/hd-wallet/v1')
  try {
    return bip39.entropyToMnemonic(Buffer.from(entropy)) // 24 words
  } finally {
    entropy.fill(0)
  }
})

// 96 bytes: zero it once you're done with it
const rootKey = fromSeed(bip39.mnemonicToSeedSync(phrase))
const xhd = new XHDWalletAPI()

// Account 0, key 0: m/44'/283'/0'/0/0
const publicKey = await xhd.keyGen(rootKey, KeyContext.Address, 0, 0)
const address = new algosdk.Address(publicKey).toString()

const signature = await xhd.signAlgoTransaction(
  rootKey,
  KeyContext.Address,
  0,
  0,
  txn.bytesToSign()
)
const signedTxn = txn.attachSignature(address, signature)
```

It's a standard 24-word BIP-39 phrase, and the library's default derivation (Peikert's) is the one Pera's HD wallets use, so a wallet with xHD support restores the same accounts from the words. `bip39` and the xHD library use Node's `Buffer`, `crypto` and `util`, so a browser bundle needs polyfills for them.

Before relying on derived keys:

* **Offer the phrase as a backup.** Nothing recovers the app secret without the passkey, and the Falcon account's [recovery phrase](#recovery-phrase) doesn't cover keys derived from it. Show the 25 or 24 words as you would that phrase, and say which kind of import they need.
* **They are ed25519 keys:** not post-quantum, and their transactions pay the regular fee.
* **They are derived on the page.** The secret, and what you derive from it, are on the main thread, where any script on the page can reach them. For keys that hold more than small amounts, have `confirm` return `'verify'` for `{ type: 'app-secret' }`, derive when a key is needed rather than at sign-in, and zero the root key afterwards.
* **One secret serves every account of the passkey.** Put the account's address in the `info` if each [rekeyed account](#rekeyed-accounts) needs keys of its own.

### Content Security Policy

The key runs in a module worker started from a `blob:` URL, using WebAssembly. If your page sets a CSP, allow both:

```
script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:
```

Without them, signing fails with a `PasskeyError` whose `code` is `key-store-failed`.

### Error Handling

Failures throw a `PasskeyError` with a `code`:

| Code               | Meaning                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `cancelled`        | The user cancelled, the request timed out, or no passkey matched (on iOS, also an in-app browser)         |
| `unsupported`      | This browser can't run passkey prompts: no WebAuthn, or an Android in-app browser                         |
| `prf-unsupported`  | The passkey provider lacks the PRF extension (Ledger Stax and Dashlane on Android are known cases)        |
| `invalid-rp-id`    | `rpId` isn't valid for the page's origin                                                                  |
| `key-mismatch`     | The passkey derived a different key than the connected account                                            |
| `not-connected`    | No passkey account is connected                                                                           |
| `not-rekeyed`      | `addRekeyedAccount`: algod doesn't report the account as rekeyed to the passkey account                   |
| `app-secret-unavailable` | `withAppSecret`: no `appSecret` option, or the passkey provider gave no second output               |
| `key-store-failed` | The key worker failed to start or was locked, e.g. because the CSP blocks it                              |
| `failed`           | Any other failure                                                                                         |

`signData` validation failures throw a `SignDataError` with an ARC-60 code. See [Signing Data](signing-data.md#error-handling).

### See Also

* [Passkey adapter README](https://github.com/TxnLab/use-wallet/tree/main/packages/wallets/passkey#readme)
* [Supported Wallets](../getting-started/supported-wallets.md#passkey)
* [useWalletManager](../api-reference/usewalletmanager.md) - Reach adapter-specific methods
* [Signing Data](signing-data.md) - ARC-60 authentication, including Falcon verification
* [use-wallet-ui React passkey example](https://github.com/TxnLab/use-wallet-ui/tree/main/examples/react-passkey) and [Vue passkey example](https://github.com/TxnLab/use-wallet-ui/tree/main/examples/vue-passkey) - Connect dialog and `passkeyPlugin`
