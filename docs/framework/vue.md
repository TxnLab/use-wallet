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

# Vue

The Vue adapter (`@txnlab/use-wallet-vue`) provides a plugin and composables for integrating use-wallet into Vue applications. This guide covers how to set up the adapter and use its features effectively.

### Setup

After installing the package, any required wallet dependencies (see [Installation](../getting-started/installation.md)), and [configuring your WalletManager](../getting-started/configuration.md), install the WalletManager plugin in your Vue application:

```typescript
// main.ts
import { createApp } from 'vue'
import { WalletManagerPlugin, NetworkId } from '@txnlab/use-wallet-vue'
import App from './App.vue'

const app = createApp(App)

app.use(WalletManagerPlugin, {
  wallets: [...],
  networks: {...},
  defaultNetwork: NetworkId.TESTNET
})

app.mount('#app')
```

The plugin makes the wallet functionality available throughout your application via Vue composables.

### Using the Composables

The Vue adapter provides two composables for accessing wallet functionality. In v4.0.0, network-related features were moved from `useWallet` into a new `useNetwork` composable to provide better separation of concerns:

#### useWallet

The `useWallet` composable provides access to wallet management features. Here's an example showing some commonly used values:

```typescript
<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'

const { 
  wallets,             // List of available wallets
  activeWallet,        // Currently active wallet
  activeAccount,       // Active account in active wallet
  activeAddress,       // Address of active account
  isReady,             // Whether all wallet providers have finished initialization
  signTransactions,    // Function to sign transactions
  transactionSigner,   // Typed signer for ATC and Algokit Utils
  algodClient          // Algod client for active network
} = useWallet()
</script>

<template>
  <div>
    <div v-if="!isReady">Loading...</div>
    <div v-else>
      <div v-if="activeAddress">
        Connected: {{ activeAddress }}
      </div>
      <div v-else>
        Not connected
      </div>
    </div>
  </div>
</template>
```

For a complete list of all available properties and methods, see the [useWallet API Reference](../api-reference/usewallet.md).

#### useNetwork

The `useNetwork` composable serves two primary functions: managing the active network and supporting runtime node configuration.

```typescript
<script setup lang="ts">
import { useNetwork } from '@txnlab/use-wallet-vue'

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

<template>
  <div>
    <!-- Example: Network selector dropdown -->
    <select
      :value="activeNetwork"
      @change="(e) => setActiveNetwork(e.target.value)"
    >
      <option
        v-for="networkId in Object.keys(networkConfig)"
        :key="networkId"
        :value="networkId"
      >
        {{ networkId }}
      </option>
    </select>
  </div>
</template>
```

Active network management (previously part of `useWallet`) enables users to switch between different networks.

Runtime node configuration, introduced in v4.0.0, enables users to override the application's default node settings and connect to any Algorand node. See the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide for details about implementing this feature.

For a complete list of all available properties and methods, see the [useNetwork API Reference](../api-reference/usenetwork.md).

### Next Steps

* Check out the [Connect Wallet Menu](../guides/connect-wallet-menu.md) guide for creating a simple wallet connection interface
* Learn about transaction signing patterns in the [Signing Transactions](../guides/signing-transactions.md) guide
* Explore network features in the [Switching Networks](../guides/switching-networks.md) and [Runtime Node Configuration](../guides/runtime-node-configuration.md) guides
* Read the [API Reference](broken-reference) for detailed documentation of the library's main exports
* Browse [Example Projects](../resources/example-projects.md) for working implementations in Vite (Vue) and Nuxt
