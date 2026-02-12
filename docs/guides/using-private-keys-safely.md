# Using Private Keys Safely

## The `withPrivateKey` Callback Pattern

The `withPrivateKey` method provides scoped access to a wallet's raw private key through a callback. The key material is guaranteed to be zeroed from memory when the callback completes, whether it succeeds or throws.

This is useful for operations beyond standard transaction signing, such as custom cryptographic operations, cross-chain signing, authentication challenges, or deriving secondary keys.

{% hint style="warning" %}
**Supported Wallets**

Only wallets that manage raw key material support `withPrivateKey`. Currently this includes:

* **Web3Auth** -- key is fetched fresh from the Web3Auth provider for each call
* **Mnemonic** -- a copy of the in-memory key is provided (testnet only)

All other wallets (Pera, Defly, Lute, WalletConnect, etc.) use external signing and will throw `"Method not supported: withPrivateKey"`. Always check `canUsePrivateKey` before calling.
{% endhint %}

### Basic Usage

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-react'

function KeyOperation() {
  const { activeWallet, withPrivateKey } = useWallet()

  const handleOperation = async () => {
    if (!activeWallet?.canUsePrivateKey) {
      console.error('This wallet does not support private key access')
      return
    }

    const result = await withPrivateKey(async (secretKey) => {
      // secretKey is a 64-byte Uint8Array (Algorand format: seed + public key)
      // Perform your operation here
      return doSomethingWith(secretKey)
    })
    // secretKey is zeroed at this point -- guaranteed
  }

  return <button onClick={handleOperation}>Run Operation</button>
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  import { useWallet } from '@txnlab/use-wallet-vue'

  const { activeWallet, withPrivateKey } = useWallet()

  const handleOperation = async () => {
    if (!activeWallet.value?.canUsePrivateKey) {
      console.error('This wallet does not support private key access')
      return
    }

    const result = await withPrivateKey(async (secretKey) => {
      return doSomethingWith(secretKey)
    })
  }
</script>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-solid'

function KeyOperation() {
  const { activeWallet, withPrivateKey } = useWallet()

  const handleOperation = async () => {
    if (!activeWallet()?.canUsePrivateKey) {
      console.error('This wallet does not support private key access')
      return
    }

    const result = await withPrivateKey(async (secretKey) => {
      return doSomethingWith(secretKey)
    })
  }

  return <button onClick={handleOperation}>Run Operation</button>
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'

  const { activeWallet, withPrivateKey } = useWallet()

  const handleOperation = async () => {
    if (!activeWallet()?.canUsePrivateKey) {
      console.error('This wallet does not support private key access')
      return
    }

    const result = await withPrivateKey(async (secretKey) => {
      return doSomethingWith(secretKey)
    })
  }
</script>

<button onclick={handleOperation}>Run Operation</button>
```
{% endtab %}
{% endtabs %}

### How It Works

The `withPrivateKey` method follows a "loan" pattern:

1. The wallet obtains the raw key material (for Web3Auth, this means a fresh fetch from the provider)
2. A **copy** of the 64-byte Algorand secret key is created for the callback
3. Your callback receives the copy and can perform any async operation with it
4. When the callback returns (or throws), the copy is overwritten with random bytes then zeroed using `zeroMemory()`
5. The original key material and any intermediate containers are also cleared

The key is a standard 64-byte Algorand secret key (32-byte ed25519 seed concatenated with 32-byte public key), compatible with `algosdk` operations.

### Security Guarantees

The library provides several layers of defense:

* **Scoped access** -- The key only exists within the callback closure. There is no method that returns a key directly.
* **Guaranteed cleanup** -- `try/finally` blocks ensure the key buffer is zeroed even if your callback throws an exception.
* **Copy isolation** -- Your callback receives an independent copy. The wallet's internal key state is never affected by what you do with the buffer.
* **Fresh fetch** -- Web3Auth fetches the key from the provider on every call. Keys are never cached between operations.
* **Anti-optimization zeroing** -- `zeroMemory()` writes random data before zeroing, preventing compiler optimizations from eliding the clear.

{% hint style="info" %}
**JavaScript Memory Limitations**

JavaScript does not offer guaranteed immediate memory clearing due to garbage collection. The `zeroMemory()` function provides defense-in-depth by overwriting the buffer contents immediately, but copies of the data could theoretically persist in GC-managed memory until collected. This is an inherent limitation of the JavaScript runtime, not a flaw in the implementation.
{% endhint %}

## Best Practices

### 1. Keep callbacks short and focused

Do the minimum amount of work needed with the key. The longer the callback runs, the longer the key material lives in memory.

```typescript
// Good -- focused operation
await withPrivateKey(async (secretKey) => {
  return signChallenge(secretKey, challenge)
})

// Avoid -- unnecessarily long key exposure
await withPrivateKey(async (secretKey) => {
  const challenge = await fetchChallengeFromServer()  // network round trip
  const signature = signChallenge(secretKey, challenge)
  await submitSignatureToServer(signature)             // another round trip
  return signature
})
```

Prefer fetching inputs before the callback and submitting results after:

```typescript
// Better -- key exposure limited to the signing operation
const challenge = await fetchChallengeFromServer()

const signature = await withPrivateKey(async (secretKey) => {
  return signChallenge(secretKey, challenge)
})

await submitSignatureToServer(signature)
```

### 2. Never copy the key out of the callback

The entire point of the callback pattern is scoped access. Copying the key defeats the automatic cleanup.

```typescript
// NEVER do this
let stolenKey: Uint8Array
await withPrivateKey(async (secretKey) => {
  stolenKey = new Uint8Array(secretKey)  // defeats the purpose
})
// stolenKey still contains the key material -- it won't be zeroed
```

If you need key material for a deferred operation, restructure your code so the operation happens inside the callback.

### 3. Check `canUsePrivateKey` before calling

Not all wallets support private key access. Always guard the call:

```typescript
if (!activeWallet?.canUsePrivateKey) {
  // Fall back to signTransactions() or show a user message
  return
}
```

### 4. Handle errors gracefully

The callback's errors propagate through `withPrivateKey`. The key is still zeroed on error, but you should handle the exception:

```typescript
try {
  await withPrivateKey(async (secretKey) => {
    return riskyOperation(secretKey)
  })
} catch (error) {
  // Key is already zeroed -- safe to log
  console.error('Operation failed:', error)
}
```

### 5. Never log or serialize the key

Avoid any operation that converts the key to a persistent or inspectable form:

```typescript
await withPrivateKey(async (secretKey) => {
  // NEVER do any of these
  console.log(secretKey)
  JSON.stringify(Array.from(secretKey))
  localStorage.setItem('key', btoa(String.fromCharCode(...secretKey)))
  sendToAnalytics(secretKey)
})
```

## Desktop App Considerations

If you are building a desktop app with Electron, Tauri, or a similar framework, be aware that desktop environments introduce additional security concerns around process isolation, memory dumps, DevTools access, and IPC boundaries. These topics are beyond the scope of this guide -- consult the [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) or [Tauri Security](https://tauri.app/security/) documentation for framework-specific guidance.

## Example: Signing a Custom Challenge

A common use case is signing an authentication challenge from a backend server:

```typescript
import { useWallet } from '@txnlab/use-wallet-react'
import nacl from 'tweetnacl'

function AuthChallenge() {
  const { activeWallet, withPrivateKey } = useWallet()

  const authenticate = async () => {
    if (!activeWallet?.canUsePrivateKey) {
      throw new Error('Wallet does not support private key access')
    }

    // Fetch challenge before accessing the key
    const { challenge, sessionId } = await fetch('/api/auth/challenge').then(r => r.json())
    const challengeBytes = new Uint8Array(
      atob(challenge).split('').map(c => c.charCodeAt(0))
    )

    // Key exposure limited to signing
    const signature = await withPrivateKey(async (secretKey) => {
      return nacl.sign.detached(challengeBytes, secretKey)
    })

    // Submit after key is cleared
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        signature: btoa(String.fromCharCode(...signature))
      })
    })

    if (!response.ok) {
      throw new Error('Authentication failed')
    }
  }

  return <button onClick={authenticate}>Authenticate</button>
}
```

This example demonstrates the recommended pattern: fetch inputs first, use `withPrivateKey` only for the cryptographic operation, and submit results after the key has been cleared.
