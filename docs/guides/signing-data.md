# Signing Data

## ARC-60 Authentication with Lute Wallet

The `useWallet` hook/composable/primitive provides a `signData` method for implementing ARC-60 authentication with the [Lute](../getting-started/supported-wallets.md#lute-wallet) wallet provider. This guide demonstrates how to implement Sign-In with Algorand (SIWA) using Lute wallet.

### Prerequisites

* A React/Vue/Solid application with [`@noble/ed25519`](https://www.npmjs.com/package/@noble/ed25519) installed (for signature verification)
* Lute wallet provider configured in your application

### Wallet Compatibility

> **Important**: Currently, only the Lute wallet provider supports ARC-60 data signing. Attempting to call `signData` with any other wallet provider will throw an error. You should check the wallet's capabilities before attempting to sign data.

### Implementation

Here's how to implement ARC-60 authentication:

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'
import { ed } from '@noble/ed25519'

function Authenticate() {
  const { activeAddress, activeWallet, signData } = useWallet()

  const handleAuth = async () => {
    try {
      if (!activeAddress) {
        throw new Error('No active account')
      }
    
      if (!activeWallet?.canSignData) {
        throw new Error('Current wallet does not support data signing')
      }

      // Create SIWA request
      const siwaRequest = {
        domain: location.host,
        chain_id: '283',
        account_address: activeAddress,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }

      // Convert request to base64
      const dataString = JSON.stringify(siwaRequest)
      const data = btoa(dataString)
      
      // Sign data with authentication scope
      const metadata = { scope: 'auth', encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
      
      const toSign = new Uint8Array(64)
      toSign.set(new Uint8Array(clientDataJsonHash), 0)
      toSign.set(new Uint8Array(authenticatorDataHash), 32)
      
      const pubKey = algosdk.Address.fromString(activeAddress).publicKey
      const isValid = await ed.verifyAsync(resp.signature, toSign, pubKey)

      if (!isValid) {
        throw new Error('Verification Failed')
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
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'
import { ed } from '@noble/ed25519'

const { activeAddress, activeWallet, signData } = useWallet()

const handleAuth = async () => {
  try {
    if (!activeAddress.value) {
      throw new Error('No active account')
    }
    
    if (!activeWallet?.canSignData) {
      throw new Error('Current wallet does not support data signing')
    }

    // Create SIWA request
    const siwaRequest = {
      domain: location.host,
      chain_id: '283',
      account_address: activeAddress.value,
      type: 'ed25519',
      uri: location.origin,
      version: '1',
      'issued-at': new Date().toISOString()
    }

    // Convert request to base64
    const dataString = JSON.stringify(siwaRequest)
    const data = btoa(dataString)
    
    // Sign data with authentication scope
    const metadata = { scope: 'auth', encoding: 'base64' }
    const resp = await signData(data, metadata)

    // Verify signature
    const enc = new TextEncoder()
    const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
    const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
    
    const toSign = new Uint8Array(64)
    toSign.set(new Uint8Array(clientDataJsonHash), 0)
    toSign.set(new Uint8Array(authenticatorDataHash), 32)
    
    const pubKey = algosdk.Address.fromString(activeAddress.value).publicKey
    const isValid = await ed.verifyAsync(resp.signature, toSign, pubKey)

    if (!isValid) {
      throw new Error('Verification Failed')
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
import { useWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'
import { ed } from '@noble/ed25519'

function Authenticate() {
  const { activeAddress, activeWallet, signData } = useWallet()

  const handleAuth = async () => {
    try {
      if (!activeAddress()) {
        throw new Error('No active account')
      }
    
      if (!activeWallet()?.canSignData) {
        throw new Error('Current wallet does not support data signing')
      }

      // Create SIWA request
      const siwaRequest = {
        domain: location.host,
        chain_id: '283',
        account_address: activeAddr,
        type: 'ed25519',
        uri: location.origin,
        version: '1',
        'issued-at': new Date().toISOString()
      }

      // Convert request to base64
      const dataString = JSON.stringify(siwaRequest)
      const data = btoa(dataString)
      
      // Sign data with authentication scope
      const metadata = { scope: 'auth', encoding: 'base64' }
      const resp = await signData(data, metadata)

      // Verify signature
      const enc = new TextEncoder()
      const clientDataJsonHash = await crypto.subtle.digest('SHA-256', enc.encode(dataString))
      const authenticatorDataHash = await crypto.subtle.digest('SHA-256', resp.authenticatorData)
      
      const toSign = new Uint8Array(64)
      toSign.set(new Uint8Array(clientDataJsonHash), 0)
      toSign.set(new Uint8Array(authenticatorDataHash), 32)
      
      const pubKey = algosdk.Address.fromString(activeAddr).publicKey
      const isValid = await ed.verifyAsync(resp.signature, toSign, pubKey)

      if (!isValid) {
        throw new Error('Verification Failed')
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
{% endtabs %}

### How It Works

1. **Create SIWA Request**: The code creates a Sign-In with Algorand (SIWA) request object containing:
   * `domain`: The current host
   * `chain_id`: The Algorand network ID (283 for MainNet)
   * `account_address`: The user's wallet address
   * `type`: The signature type (ed25519)
   * `uri`: The origin URL
   * `version`: The SIWA version
   * `issued-at`: The current timestamp
2. **Sign Data**: The request is converted to base64 and signed using the `signData` method with:
   * `scope`: Set to 'auth' for authentication
   * `encoding`: Set to 'base64' for the data format
3. **Verify Signature**: The signature is verified by:
   * Computing SHA-256 hashes of the client data and authenticator data
   * Combining the hashes into a single buffer
   * Using the user's public key to verify the signature

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

For more information about ARC-60 and Sign-In with Algorand, see the [ARC-60 specification](https://github.com/algorandfoundation/ARCs/pull/313).
