# Signing Data

## ARC-60 Authentication with Lute Wallet

The `useWallet` hook/composable/primitive provides a `signData` method for implementing ARC-60 authentication with the [Lute](../getting-started/supported-wallets.md#lute-wallet) wallet provider. This guide demonstrates how to implement Sign-In with Algorand (SIWA) using Lute wallet.

{% hint style="info" %}
**Wallet Compatibility**

Currently, only the Lute wallet provider supports ARC-60 data signing. Attempting to call `signData` with any other wallet provider will throw an error. You should check the wallet's capabilities before attempting to sign data.
{% endhint %}

### Implementation

Here's how to implement ARC-60 authentication:

{% tabs %}
{% tab title="React" %}
```tsx
import * as ed from '@noble/ed25519'
import {
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa,
  type StdSignData
} from '@txnlab/use-wallet-react'
import { Address } from 'algosdk'
import { canonify } from 'canonify'

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

function Authenticate() {
  const { activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  const handleAuth = async () => {
    if (!activeAddress) return

    try {
      const domain = location.host
      const acctInfo = await algodClient.accountInformation(activeAddress).do()

      // Create SIWA request
      const siwaRequest: Siwa = {
        domain,
        chain_id: activeNetworkConfig.caipChainId || 'algorand',
        account_address: activeAddress,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Build the StdSignData object
      const enc = new TextEncoder()
      const authenticatorData = await sha256(enc.encode(domain))
      const signer = acctInfo.authAddr?.publicKey ?? Address.fromString(activeAddress).publicKey
      const stdSignData: StdSignData = {
        data,
        signer,
        domain,
        authenticatorData
      }

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(stdSignData, metadata)

      // Verify signature
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(authenticatorData)
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
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
    ScopeType,
    SignDataError,
    useNetwork,
    useWallet,
    type Siwa,
    type StdSignData
  } from '@txnlab/use-wallet-vue'
  import { Address } from 'algosdk'
  import { canonify } from 'canonify'

  const { activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  async function sha256(data: BufferSource) {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(buf)
  }

  const handleAuth = async () => {
    if (!activeAddress.value) return

    try {
      const domain = location.host
      const acctInfo = await algodClient.value.accountInformation(activeAddress.value).do()

      // Create SIWA request
      const siwaRequest: Siwa = {
        domain,
        chain_id: activeNetworkConfig.value.caipChainId || 'algorand',
        account_address: activeAddress.value,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Build the StdSignData object
      const enc = new TextEncoder()
      const authenticatorData = await sha256(enc.encode(domain))
      const signer =
        acctInfo.authAddr?.publicKey ?? Address.fromString(activeAddress.value).publicKey
      const stdSignData: StdSignData = {
        data,
        signer,
        domain,
        authenticatorData
      }

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(stdSignData, metadata)

      // Verify signature
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(authenticatorData)
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
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
  ScopeType,
  SignDataError,
  useNetwork,
  useWallet,
  type Siwa,
  type StdSignData
} from '@txnlab/use-wallet-solid'
import { Address } from 'algosdk'
import { canonify } from 'canonify'

async function sha256(data: BufferSource) {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buf)
}

function Authenticate() {
  const { activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  const handleAuth = async () => {
    const address = activeAddress()
    if (!address) return

    try {
      const domain = location.host
      const acctInfo = await algodClient().accountInformation(address).do()

      // Create SIWA request
      const siwaRequest: Siwa = {
        domain,
        chain_id: activeNetworkConfig().caipChainId || 'algorand',
        account_address: address,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Build the StdSignData object
      const enc = new TextEncoder()
      const authenticatorData = await sha256(enc.encode(domain))
      const signer = acctInfo.authAddr?.publicKey ?? Address.fromString(address).publicKey
      const stdSignData: StdSignData = {
        data,
        signer,
        domain,
        authenticatorData
      }

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(stdSignData, metadata)

      // Verify signature
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(authenticatorData)
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
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
    ScopeType,
    SignDataError,
    useNetwork,
    useWallet,
    type Siwa,
    type StdSignData
  } from '@txnlab/use-wallet-svelte'
  import { Address } from 'algosdk'
  import { canonify } from 'canonify'

  const { activeAddress, algodClient, signData } = useWallet()
  const { activeNetworkConfig } = useNetwork()

  async function sha256(data: BufferSource) {
    const buf = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(buf)
  }

  const handleAuth = async () => {
    const address = activeAddress.current
    const client = algodClient.current
    if (!address || !client) return

    try {
      const domain = location.host
      const acctInfo = await client.accountInformation(address).do()

      // Create SIWA request
      const siwaRequest: Siwa = {
        domain,
        chain_id: activeNetworkConfig.current.caipChainId || 'algorand',
        account_address: address,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }
      const dataString = canonify(siwaRequest)
      if (!dataString) throw Error('Invalid JSON')
      const data = btoa(dataString)

      // Build the StdSignData object
      const enc = new TextEncoder()
      const authenticatorData = await sha256(enc.encode(domain))
      const signer = acctInfo.authAddr?.publicKey ?? Address.fromString(address).publicKey
      const stdSignData: StdSignData = {
        data,
        signer,
        domain,
        authenticatorData
      }

      // Sign data with authentication scope
      const metadata = { scope: ScopeType.AUTH, encoding: 'base64' }
      const resp = await signData(stdSignData, metadata)

      // Verify signature
      const clientDataJsonHash = await sha256(enc.encode(dataString))
      const authenticatorDataHash = await sha256(authenticatorData)
      const toSign = new Uint8Array([...clientDataJsonHash, ...authenticatorDataHash])
      if (!(await ed.verifyAsync(resp.signature, toSign, signer))) {
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
     * `chain_id` - The [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) chain identifier for the active network, read from `activeNetworkConfig.caipChainId` (e.g. `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` for MainNet), falling back to `'algorand'` when a custom network has no CAIP chain ID
     * `account_address` - The user's wallet address
     * `type` - The signature type (ed25519)
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
2. **Build the StdSignData object**: The canonified request is base64-encoded and packaged into a `StdSignData` object, which is the first argument passed to `signData`:
   * `data` - The base64-encoded SIWA request
   * `signer` - The public key that will sign the data. Account information is fetched from the algod client so that rekeyed accounts sign with their auth address (`acctInfo.authAddr?.publicKey`), falling back to the active address's public key
   * `domain` - The current host
   * `authenticatorData` - The SHA-256 hash of the domain
   * `requestId` - An optional unique identifier for the request
   * `hdPath` - An optional HD derivation path
3. **Sign Data**: The `StdSignData` object is signed using the `signData` method, passing metadata as the second argument:
   * `scope` - Set to `ScopeType.AUTH` for authentication
   * `encoding` - Set to `'base64'` for the data format
4. **Verify Signature**: The signature is verified by:
   * Computing SHA-256 hashes of the client data and authenticator data
   * Combining the hashes into a single buffer
   * Using the signer's public key to verify the signature

{% hint style="info" %}
**Signature Verification**

While this example demonstrates signature verification in the front-end for simplicity, in a production environment, it's generally better to perform signature verification on the backend. This approach provides better security and allows for proper session management and authentication state persistence.
{% endhint %}

### Error Handling

The implementation includes error handling for:

* Missing active account
* Unsupported wallet provider
* Failed signature verification
* General signing errors

### Best Practices

1. Always verify the signature before accepting the authentication
2. Store the authentication result securely
3. Implement proper error handling and user feedback
4. Use HTTPS for secure communication
5. Consider implementing session management

### Resources

* [CAIP-122 specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md) - Chain-agnostic sign-in standard
* [ARC-60 specification](https://github.com/algorandfoundation/ARCs/pull/313) - Algorand implementation of CAIP-122 (Draft)
