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

# Custom Provider

While use-wallet includes support for many popular Algorand wallets, you may need to integrate an unsupported wallet or implement custom wallet behaviors. The custom provider feature enables this by allowing you to create and configure your own wallet implementation.

### Basic Implementation

To create a custom provider, you'll need to:

1. Create a class that implements the `CustomProvider` interface
2. Add the provider to your WalletManager configuration

Here's a minimal example:

```typescript
import { CustomProvider, WalletAccount } from '@txnlab/use-wallet'

class MyWalletProvider implements CustomProvider {
  async connect(): Promise<WalletAccount[]> {
    // Connect to your wallet and return array of accounts
    return [{
      name: 'Account 1',
      address: 'ABC...'
    }]
  }

  async signTransactions(
    txnGroup: algosdk.Transaction[] | Uint8Array[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    // Sign transactions and return array of signed txns
    // Return null for unsigned transactions
    return [/* signed transaction */]
  }
}

// Add to WalletManager configuration
const manager = new WalletManager({
  wallets: [{
    id: WalletId.CUSTOM,
    options: {
      provider: new MyWalletProvider()
    },
    metadata: {
      name: 'My Wallet',
      icon: '/path/to/icon.svg'
    }
  }],
  defaultNetwork: 'testnet'
})
```

### Provider Interface

The `CustomProvider` interface defines the following methods:

```typescript
interface CustomProvider {
  // Required: Connect to wallet and return accounts
  connect(args?: Record<string, any>): Promise<WalletAccount[]>
  
  // Optional: Clean up when disconnecting
  disconnect?(): Promise<void>
  
  // Optional: Restore previous session
  resumeSession?(): Promise<WalletAccount[] | void>
  
  // Optional: Sign transactions (implement at least one signing method)
  signTransactions?(
    txnGroup: algosdk.Transaction[] | Uint8Array[] | (algosdk.Transaction[] | Uint8Array[])[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]>
  
  // Optional: Sign with ATC-compatible signer
  transactionSigner?(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]>
}
```

### Required Methods

#### **connect**

The `connect` method is the only required method. It should:

* Connect to the wallet provider
* Return an array of `WalletAccount` objects
* Accept an optional `args` parameter for custom configuration

```typescript
interface WalletAccount {
  name: string           // Display name
  address: string        // Algorand address
}
```

### Optional Methods

#### **disconnect**

The `disconnect` method should clean up any resources or state when the wallet is disconnected. This might include:

* Removing event listeners
* Clearing cached data
* Notifying the wallet provider

#### **resumeSession**

The `resumeSession` method enables automatic reconnection when the application loads. If implemented, it should:

* Check for an existing wallet connection
* Return connected accounts if found
* Return void if no session exists

### Signing Methods

At least one of the signing methods should be implemented to enable transaction signing.

#### **signTransactions**

The `signTransactions` method provides direct transaction signing:

```typescript
async signTransactions(
  txnGroup: algosdk.Transaction[] | Uint8Array[],
  indexesToSign?: number[]
): Promise<(Uint8Array | null)[]> {
  // Sign transactions at specified indexes
  // Return array matching input length with:
  // - Uint8Array for signed transactions
  // - null for unsigned transactions
}
```

#### **transactionSigner**

The `transactionSigner` method provides an ATC-compatible signer:

```typescript
async transactionSigner(
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[]
): Promise<Uint8Array[]> {
  // Sign specified transactions
  // Return array containing only signed transactions
}
```

### Complete Example

Here's a complete example showing a custom provider with all optional methods implemented:

{% tabs %}
{% tab title="React" %}
```tsx
import { CustomProvider, WalletAccount, useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'

class MyWalletProvider implements CustomProvider {
  private accounts: WalletAccount[] = []
  
  async connect(): Promise<WalletAccount[]> {
    // Connect to wallet
    this.accounts = [{
      name: 'Account 1',
      address: 'ABC...'
    }]
    return this.accounts
  }
  
  async disconnect(): Promise<void> {
    // Clean up
    this.accounts = []
  }
  
  async resumeSession(): Promise<WalletAccount[] | void> {
    // Check for existing session
    if (localStorage.getItem('wallet-connected')) {
      return this.connect()
    }
  }
  
  async signTransactions(
    txnGroup: algosdk.Transaction[] | Uint8Array[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    // Convert to Transaction objects if needed
    const txns = txnGroup.map(txn => {
      return txn instanceof Uint8Array
        ? algosdk.decodeSignedTransaction(txn).txn
        : txn
    })
    
    // Default to signing all transactions
    const idxs = indexesToSign ?? txns.map((_, i) => i)
    
    // Return array matching input length
    return txns.map((txn, i) => {
      if (!idxs.includes(i)) return null
      return /* signed transaction */
    })
  }
  
  async transactionSigner(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> {
    const signed = await this.signTransactions(txnGroup, indexesToSign)
    return signed.filter((s): s is Uint8Array => s !== null)
  }
}

// Usage in component
function WalletConnect() {
  const { activeAccount } = useWallet()
  
  return (
    <div>
      {activeAccount ? (
        <div>Connected: {activeAccount.address}</div>
      ) : (
        <div>Not connected</div>
      )}
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { CustomProvider, WalletAccount, useWallet } from '@txnlab/use-wallet-vue'
  import algosdk from 'algosdk'

  class MyWalletProvider implements CustomProvider {
    private accounts: WalletAccount[] = []
    
    async connect(): Promise<WalletAccount[]> {
      // Connect to wallet
      this.accounts = [{
        name: 'Account 1',
        address: 'ABC...',
        providerId: 'my-wallet'
      }]
      return this.accounts
    }
    
    async disconnect(): Promise<void> {
      // Clean up
      this.accounts = []
    }
    
    async resumeSession(): Promise<WalletAccount[] | void> {
      // Check for existing session
      if (localStorage.getItem('wallet-connected')) {
        return this.connect()
      }
    }
    
    async signTransactions(
      txnGroup: algosdk.Transaction[] | Uint8Array[],
      indexesToSign?: number[]
    ): Promise<(Uint8Array | null)[]> {
      // Implementation details same as React example
    }
    
    async transactionSigner(
      txnGroup: algosdk.Transaction[],
      indexesToSign: number[]
    ): Promise<Uint8Array[]> {
      const signed = await this.signTransactions(txnGroup, indexesToSign)
      return signed.filter((s): s is Uint8Array => s !== null)
    }
  }

  const { activeAccount } = useWallet()
</script>

<template>
  <div>
    <div v-if="activeAccount">
      Connected: {{ activeAccount.address }}
    </div>
    <div v-else>
      Not connected
    </div>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { CustomProvider, WalletAccount, useWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'

class MyWalletProvider implements CustomProvider {
  private accounts: WalletAccount[] = []
  
  async connect(): Promise<WalletAccount[]> {
    // Connect to wallet
    this.accounts = [{
      name: 'Account 1',
      address: 'ABC...',
      providerId: 'my-wallet'
    }]
    return this.accounts
  }
  
  async disconnect(): Promise<void> {
    // Clean up
    this.accounts = []
  }
  
  async resumeSession(): Promise<WalletAccount[] | void> {
    // Check for existing session
    if (localStorage.getItem('wallet-connected')) {
      return this.connect()
    }
  }
  
  async signTransactions(
    txnGroup: algosdk.Transaction[] | Uint8Array[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    // Implementation details same as React example
  }
  
  async transactionSigner(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> {
    const signed = await this.signTransactions(txnGroup, indexesToSign)
    return signed.filter((s): s is Uint8Array => s !== null)
  }
}

function WalletConnect() {
  const { activeAccount } = useWallet()
  
  return (
    <div>
      {activeAccount() ? (
        <div>Connected: {activeAccount().address}</div>
      ) : (
        <div>Not connected</div>
      )}
    </div>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { CustomProvider, WalletAccount, useWallet } from '@txnlab/use-wallet-svelte'
  import algosdk from 'algosdk'

  class MyWalletProvider implements CustomProvider {
    private accounts: WalletAccount[] = []
    
    async connect(): Promise<WalletAccount[]> {
      // Connect to wallet
      this.accounts = [{
        name: 'Account 1',
        address: 'ABC...',
        providerId: 'my-wallet'
      }]
      return this.accounts
    }
    
    async disconnect(): Promise<void> {
      // Clean up
      this.accounts = []
    }
    
    async resumeSession(): Promise<WalletAccount[] | void> {
      // Check for existing session
      if (localStorage.getItem('wallet-connected')) {
        return this.connect()
      }
    }
    
    async signTransactions(
      txnGroup: algosdk.Transaction[] | Uint8Array[],
      indexesToSign?: number[]
    ): Promise<(Uint8Array | null)[]> {
      // Implementation details same as React example
    }
    
    async transactionSigner(
      txnGroup: algosdk.Transaction[],
      indexesToSign: number[]
    ): Promise<Uint8Array[]> {
      const signed = await this.signTransactions(txnGroup, indexesToSign)
      return signed.filter((s): s is Uint8Array => s !== null)
    }
  }

  const { activeAccount } = useWallet()
</script>

<div>
  {#if activeAccount()}
    <div>
      Connected: {{ activeAccount.address }}
    </div>
  {:else}
    <div>
      Not connected
    </div>
</div>
```
{% endtab %}
{% endtabs %}

### Next Steps

* See the [Signing Transactions](signing-transactions.md) guide for more details about implementing signing methods
* Read about setting up the provider in your application in the [Configuration](../getting-started/configuration.md) guide
* Browse the [Example Projects](../resources/example-projects.md) for complete implementation examples
