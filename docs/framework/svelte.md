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

# Svelte

The Svelte adapter (`@txnlab/use-wallet-svelte`) provides primitives for integrating use-wallet into Svelte applications. This guide covers how to set up the adapter and use its features effectively.

### Setup

After installing the package and any required wallet dependencies (see [Installation](../getting-started/installation.md)) and [configuring your WalletManager](../getting-started/configuration.md), call `useWalletContext` in your base `+layout.svelte`:

```ts
import {
  useWalletContext,
  WalletManager,
  NetworkId
} from '@txnlab/use-wallet-svelte'

// Create manager instance (see Configuration guide)
const manager = new WalletManager({
  wallets: [...],
  networks: {...},
  defaultNetwork: NetworkId.TESTNET
})

useWalletContext(manager)
```

This makes the wallet functionality available throughout your application via Svelte's primitives.

### Using the Primitives

The Svelte adapter provides two primitives for accessing wallet functionality. In v4.0.0, network-related features were moved from `useWallet` into a new `useNetwork` primitive to provide better separation of concerns:

#### useWallet

The `useWallet` primitive provides access to wallet management features. Here's an example showing some commonly used values:

```typescript
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  const { 
    wallets,             // List of available wallets
    activeWallet,        // Currently active wallet (function)
    activeAccount,       // Active account in active wallet
    activeAddress,       // Address of active account
    isReady,             // Whether all wallet providers have finished initialization
    signTransactions,    // Function to sign transactions
    transactionSigner,   // Typed signer for ATC and Algokit Utils
    algodClient          // Algod client for active network
  } = useWallet()
</script>

{#if isReady()}
  {#if activeAddress.current}
    <div>Connected: {activeAddress.current}</div>
  {:else}
    <div>Not connected</div>
  {/if}
{:else}
  <div>Loading...</div>
{/if}
```

Note that unlike [React's hooks](react.md#using-the-hooks), Svelte's primitives return functions that need to be called to access their current value. The values are automatically tracked and will trigger reactivity when they change.

For a complete list of all available properties and methods, see the [useWallet API Reference](../api-reference/usewallet.md).

#### useNetwork

The `useNetwork` primitive serves two primary functions: managing the active network and supporting runtime node configuration.

```typescript
<script lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-svelte'

  const {
    // Active network management
    activeNetwork,         // Currently active network
    setActiveNetwork,      // Function to change networks
    
    // Runtime node configuration
    networkConfig,         // Complete configuration for all networks
    activeNetworkConfig,   // Configuration for active network only
    updateAlgodConfig,     // Update a network's Algod configuration
    resetNetworkConfig     // Reset network config to initial values
  } = useNetwork()
</script>

<div>
  <!-- Example: Network selector dropdown -->
  <select
    value={activeNetwork.current}
    onchange={(e) => setActiveNetwork(e.currentTarget.value)}
  >
    {#each Object.keys(networkConfig()) as networkId}
      <option>
        {networkId}
      </option>
    {/each}
  </select>
</div>
```

Active network management enables users to switch between different networks.

Runtime node configuration, enables users to override the application's default node settings and connect to any Algorand node. See the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide for details about implementing this feature.

For a complete list of all available properties and methods, see the [useNetwork API Reference](../api-reference/usenetwork.md).

### Working with Reactive Values

The Svelte adapter uses a `.current` property pattern for accessing reactive values:

```tsx
<script lang="ts">
  import { useWallet, useNetwork } from '@txnlab/use-wallet-svelte'

  const { activeAddress } = useWallet()
  const { activeNetwork } = useNetwork()
  
  // Access reactive values using .current
  $: console.log(activeAddress.current)
  $: console.log(activeNetwork.current)
</script>
```

This pattern integrates with [TanStack Store](https://tanstack.com/store) for cross-framework consistency. The `.current` property aligns directly with TanStack Store's reactive system (see the [`useStore` reference](https://tanstack.com/store/v0/docs/framework/svelte/reference/functions/usestore)) and ensures consistent behavior across all framework adapters (React, Vue, SolidJS) while providing reliable reactivity within Svelte's compilation context.

### Next Steps

* Check out the [Connect Wallet Menu](../guides/connect-wallet-menu.md) guide for creating a simple wallet connection interface
* Learn about transaction signing patterns in the [Signing Transactions](../guides/signing-transactions.md) guide
* Explore network features in the [Switching Networks](../guides/switching-networks.md) and [Runtime Node Configuration](../guides/runtime-node-configuration.md) guides
* Read the [API Reference](broken-reference) for detailed documentation of the library's main exports
* Browse [Example Projects](../resources/example-projects.md) for a working implementation in Vite (Svelte)
