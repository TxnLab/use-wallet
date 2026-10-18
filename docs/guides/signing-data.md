# Signing Data

## ARC-60 Authentication

The `useWallet` hook/composable/primitive provides a `signData` method for implementing ARC-60 authentication with supported wallet providers. This guide demonstrates how to implement Sign-In with Algorand (SIWA).

{% hint style="info" %}
**Wallet Compatibility**

Currently, the [Lute](../getting-started/supported-wallets.md#lute-wallet) and [Pera](../getting-started/supported-wallets.md#pera-wallet) wallet providers support ARC-60 data signing. Attempting to call `signData` with any other wallet provider will throw an error. You should check the wallet's `canSignData` capability before attempting to sign data.

Post-quantum (Falcon-1024) accounts can sign data with wallets that support ARC-60's `scheme` field, such as Lute.
{% endhint %}

### Implementation

Here's how to implement ARC-60 authentication. The examples verify ed25519 signatures with [`@noble/ed25519`](https://www.npmjs.com/package/@noble/ed25519) and Falcon signatures with [`falcon-1024`](https://www.npmjs.com/package/falcon-1024):

```bash
npm install @noble/ed25519 falcon-1024 canonify
```

{% tabs %}
{% tab title="React" %}
```tsx
import * as ed from '@noble/ed25519'
import {
  getSignDataScheme,
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa
} from '@txnlab/use-wallet-react'
import { Address, addressFromPQKey, FALCON_1024_SCHEME } from 'algosdk'
import { canonify } from 'canonify'

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

// A Falcon key must authorize the account: its address (or the account's auth
// address, if rekeyed) is derived from the key
async function verifyFalcon(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
  authAddr: Address
) {
  if (!addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.equals(authAddr)) return false
  const { verifyCompressed } = await import('falcon-1024')
  try {
    return verifyCompressed(publicKey, signature, message)
  } catch {
    // verifyCompressed throws for an invalid signature
    return false
  }
}

function Authenticate() {
  const { activeAccount, activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  const handleAuth = async () => {
    if (!activeAddress) return

    try {
      // Create SIWA request
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: activeNetworkConfig.caipChainId || 'algorand:localnet',
        account_address: activeAddress,
        type: getSignDataScheme(activeAccount?.emptySignature) ?? 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const acctInfo = await algodClient.accountInformation(activeAddress).do()
      const authAddr = acctInfo.authAddr ?? Address.fromString(activeAddress)
      const enc = new TextEncoder()
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(new Uint8Array(resp.authenticatorData))
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      const verified =
        siwaRequest.type === 'falcon-1024-det'
          ? await verifyFalcon(resp.signer, resp.signature, toSign, authAddr)
          : await ed.verifyAsync(resp.signature, toSign, authAddr.publicKey)
      if (!verified) {
        throw new SignDataError('Verification Failed', 4300)
      }

      console.info('Successfully authenticated!')
    } catch (error) {
      console.error('Error signing data:', error)
    }
  }

  return (
    <button onClick={handleAuth}>Sign In with Algorand</button>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  import * as ed from '@noble/ed25519'
  import {
    getSignDataScheme,
    ScopeType,
    SignDataError,
    useNetwork,
    useWallet,
    type Siwa
  } from '@txnlab/use-wallet-vue'
  import { Address, addressFromPQKey, FALCON_1024_SCHEME } from 'algosdk'
  import { canonify } from 'canonify'

  const { activeAccount, activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  async function sha256(data: BufferSource) {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(buf)
  }

  // A Falcon key must authorize the account: its address (or the account's auth
  // address, if rekeyed) is derived from the key
  async function verifyFalcon(
    publicKey: Uint8Array,
    signature: Uint8Array,
    message: Uint8Array,
    authAddr: Address
  ) {
    if (!addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.equals(authAddr)) return false
    const { verifyCompressed } = await import('falcon-1024')
    try {
      return verifyCompressed(publicKey, signature, message)
    } catch {
      // verifyCompressed throws for an invalid signature
      return false
    }
  }

  const handleAuth = async () => {
    if (!activeAddress.value) return

    try {
      // Create SIWA request
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: activeNetworkConfig.value.caipChainId || 'algorand:localnet',
        account_address: activeAddress.value,
        type: getSignDataScheme(activeAccount.value?.emptySignature) ?? 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const acctInfo = await algodClient.value.accountInformation(activeAddress.value).do()
      const authAddr = acctInfo.authAddr ?? Address.fromString(activeAddress.value)
      const enc = new TextEncoder()
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(new Uint8Array(resp.authenticatorData))
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      const verified =
        siwaRequest.type === 'falcon-1024-det'
          ? await verifyFalcon(resp.signer, resp.signature, toSign, authAddr)
          : await ed.verifyAsync(resp.signature, toSign, authAddr.publicKey)
      if (!verified) {
        throw new SignDataError('Verification Failed', 4300)
      }

      console.info('Successfully authenticated!')
    } catch (error) {
      console.error('Error signing data:', error)
    }
  }
</script>

<template>
  <button @click="handleAuth">Sign In with Algorand</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import * as ed from '@noble/ed25519'
import {
  getSignDataScheme,
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa
} from '@txnlab/use-wallet-solid'
import { Address, addressFromPQKey, FALCON_1024_SCHEME } from 'algosdk'
import { canonify } from 'canonify'

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

// A Falcon key must authorize the account: its address (or the account's auth
// address, if rekeyed) is derived from the key
async function verifyFalcon(
  publicKey: Uint8Array,
  signature: Uint8Array,
  message: Uint8Array,
  authAddr: Address
) {
  if (!addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.equals(authAddr)) return false
  const { verifyCompressed } = await import('falcon-1024')
  try {
    return verifyCompressed(publicKey, signature, message)
  } catch {
    // verifyCompressed throws for an invalid signature
    return false
  }
}

function Authenticate() {
  const { activeAccount, activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  const handleAuth = async () => {
    const address = activeAddress()
    if (!address) return

    try {
      // Create SIWA request
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: activeNetworkConfig().caipChainId || 'algorand:localnet',
        account_address: address,
        type: getSignDataScheme(activeAccount()?.emptySignature) ?? 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const acctInfo = await algodClient().accountInformation(address).do()
      const authAddr = acctInfo.authAddr ?? Address.fromString(address)
      const enc = new TextEncoder()
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(new Uint8Array(resp.authenticatorData))
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      const verified =
        siwaRequest.type === 'falcon-1024-det'
          ? await verifyFalcon(resp.signer, resp.signature, toSign, authAddr)
          : await ed.verifyAsync(resp.signature, toSign, authAddr.publicKey)
      if (!verified) {
        throw new SignDataError('Verification Failed', 4300)
      }

      console.info('Successfully authenticated!')
    } catch (error) {
      console.error('Error signing data:', error)
    }
  }

  return (
    <button onClick={handleAuth}>Sign In with Algorand</button>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  import * as ed from '@noble/ed25519'
  import {
    getSignDataScheme,
    ScopeType,
    SignDataError,
    useNetwork,
    useWallet,
    type Siwa
  } from '@txnlab/use-wallet-svelte'
  import { Address, addressFromPQKey, FALCON_1024_SCHEME } from 'algosdk'
  import { canonify } from 'canonify'

  const { activeAccount, activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  async function sha256(data: BufferSource) {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(buf)
  }

  // A Falcon key must authorize the account: its address (or the account's auth
  // address, if rekeyed) is derived from the key
  async function verifyFalcon(
    publicKey: Uint8Array,
    signature: Uint8Array,
    message: Uint8Array,
    authAddr: Address
  ) {
    if (!addressFromPQKey(FALCON_1024_SCHEME, publicKey).address.equals(authAddr)) return false
    const { verifyCompressed } = await import('falcon-1024')
    try {
      return verifyCompressed(publicKey, signature, message)
    } catch {
      // verifyCompressed throws for an invalid signature
      return false
    }
  }

  const handleAuth = async () => {
    const address = activeAddress.current
    const client = algodClient.current
    if (!address || !client) return

    try {
      // Create SIWA request
      const siwaRequest: Siwa = {
        domain: location.host,
        chain_id: activeNetworkConfig.current.caipChainId || 'algorand:localnet',
        account_address: address,
        type: getSignDataScheme(activeAccount.current?.emptySignature) ?? 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const acctInfo = await client.accountInformation(address).do()
      const authAddr = acctInfo.authAddr ?? Address.fromString(address)
      const enc = new TextEncoder()
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(new Uint8Array(resp.authenticatorData))
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      const verified =
        siwaRequest.type === 'falcon-1024-det'
          ? await verifyFalcon(resp.signer, resp.signature, toSign, authAddr)
          : await ed.verifyAsync(resp.signature, toSign, authAddr.publicKey)
      if (!verified) {
        throw new SignDataError('Verification Failed', 4300)
      }

      console.info('Successfully authenticated!')
    } catch (error) {
      console.error('Error signing data:', error)
    }
  }
</script>

<button onclick={handleAuth}>Sign In with Algorand</button>
```
{% endtab %}
{% endtabs %}

### How It Works

1. **Create SIWA Request**: The code creates a Sign-In with Algorand (SIWA) request object containing:
   * Required Properties
     * `domain` - The current host
     * `chain_id` - The [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) chain identifier for the active network, read from `activeNetworkConfig.caipChainId` (e.g. `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` for MainNet), falling back to `'algorand:localnet'` when a custom network has no CAIP chain ID
     * `account_address` - The user's wallet address
     * `type` - The signing scheme of the account's key: `'ed25519'` or `'falcon-1024-det'`. `getSignDataScheme(activeAccount.emptySignature)` returns it from the empty signature the wallet advertised for the account when it connected, and the examples fall back to `'ed25519'` for wallets that don't advertise one. Wallets reject a request whose `type` doesn't match the scheme they sign with.
     * `uri` - The origin URL
     * `version` - The SIWA version
   * Optional Properties
     * `statement` - A human-readable statement about the purpose of the sign-in
     * `nonce` - A unique value to prevent replay attacks
     * `issued-at` - The timestamp when the request was created
     * `expiration-time` - When the request should expire
     * `not-before` - The earliest time the request should be considered valid
     * `request-id` - A unique identifier for the request
     * `resources` - An array of URIs the user is requesting access to
   * The SIWA request format follows the [CAIP-122 specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md) for chain-agnostic sign-in.
2. **Sign Data**: The canonified request is base64-encoded and passed to `signData` as a string, with metadata as the second argument:
   * `scope` - Set to `ScopeType.AUTH` for authentication
   * `encoding` - Set to `'base64'` for the data format
   * The wallet adapter packages the data into an ARC-60 `StdSignData` object internally: it resolves the signer public key via the algod client (so rekeyed accounts sign with their auth address), sets `domain` to the current host, and derives `authenticatorData` from the SHA-256 hash of the domain.
   * For a Falcon account, the signer is the account's Falcon public key and `scheme` is set to `'falcon-1024-det'`. Before calling the wallet, the adapter checks that the key authorizes the account on the active network, and throws a `SignDataError` (code 4603) if the account has been rekeyed away from it.
3. **Verify Signature**: The signature is verified by:
   * Resolving the account's auth address the same way the adapter does: `acctInfo.authAddr` if the account has been rekeyed, otherwise the active address
   * Computing SHA-256 hashes of the client data and the `authenticatorData` returned in the response, and combining them into a single buffer. Both schemes sign the same bytes.
   * For ed25519, verifying the signature with the auth address's public key
   * For Falcon, checking that the returned `signer` key derives the auth address (`addressFromPQKey(FALCON_1024_SCHEME, resp.signer)`), then verifying the signature with that key. Without the address check, a valid signature only proves possession of *some* Falcon key, not of one that controls the account.

{% hint style="info" %}
**Adapter Authors**

Wallet adapters that support ARC-60 signing can call the protected `createStdSignData(data)` helper on `BaseWallet`. It builds the `StdSignData` object for the active account — resolving the signer public key via algod (respecting rekeyed accounts), using the Falcon public key and `scheme` for post-quantum accounts, and hashing the current domain into `authenticatorData` — so an adapter's `signData` implementation only needs to forward the result to the wallet.
{% endhint %}

{% hint style="info" %}
**Signature Verification**

While this example demonstrates signature verification in the front-end for simplicity, in a production environment, it's generally better to perform signature verification on the backend. This approach provides better security and allows for proper session management and authentication state persistence.

A backend runs the same steps: look up the account's auth address on the network named by the request's `chain_id`, check that the signer key resolves to it (for Falcon), and verify the signature. `falcon-1024` runs in Node.js as well as the browser. The examples load it with a dynamic `import()`, so its WebAssembly is only downloaded when a Falcon signature is verified.
{% endhint %}

### Error Handling

The implementation includes error handling for:

* Missing active account
* Unsupported wallet provider
* Failed signature verification
* General signing errors

For post-quantum accounts, `signData` also throws a `SignDataError` with code 4601 if the account's signature scheme isn't supported, or 4603 if its Falcon key no longer authorizes the account (for example, after a rekey). Reconnecting the wallet refreshes the account's empty signature.

### Best Practices

1. Always verify the signature before accepting the authentication
2. Store the authentication result securely
3. Implement proper error handling and user feedback
4. Use HTTPS for secure communication
5. Consider implementing session management

{% hint style="warning" %}
**Important:** Some wallet providers require signature requests to be initiated by direct user interaction (such as a button click). For web wallets this is enforced by the browser as a security measure. It is generally good practice to ensure each signature request is triggered by a user action like clicking a button.
{% endhint %}

### Resources

* [CAIP-122 specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md) - Chain-agnostic sign-in standard
* [ARC-60 specification](https://github.com/algorandfoundation/ARCs/pull/313) - Algorand implementation of CAIP-122 (Draft)
