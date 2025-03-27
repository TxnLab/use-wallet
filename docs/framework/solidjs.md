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

# SolidJS

The SolidJS adapter (`@txnlab/use-wallet-solid`) provides primitives and components for integrating use-wallet into Solid applications. This guide covers how to set up the adapter and use its features effectively.

### Setup

After installing the package and any required wallet dependencies (see [Installation](../getting-started/installation.md)) and [configuring your WalletManager](../getting-started/configuration.md), wrap your application with the `WalletProvider`:

```tsx
import {
  WalletProvider,
  WalletManager,
  NetworkId,
} from '@txnlab/use-wallet-solid'

// Create manager instance (see Configuration guide)
const manager = new WalletManager({
  wallets: [...],
  networks: {...},
  defaultNetwork: NetworkId.TESTNET
})

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourApp />
    </WalletProvider>
  )
}
```

The provider makes the wallet functionality available throughout your application via Solid's primitives.

### Using the Primitives

The Solid adapter provides two primitives for accessing wallet functionality. In v4.0.0, network-related features were moved from `useWallet` into a new `useNetwork` primitive to provide better separation of concerns:

#### useWallet

The `useWallet` primitive provides access to wallet management features. Here's an example showing some commonly used values:

```tsx
import { useWallet } from '@txnlab/use-wallet-solid'

function WalletInfo() {
  const { 
    wallets,             // List of available wallets
    activeWallet,        // Currently active wallet (signal)
    activeAccount,       // Active account in active wallet (signal)
    activeAddress,       // Address of active account (signal)
    isReady,             // Whether all wallet providers have finished initialization (signal)
    signTransactions,    // Function to sign transactions
    transactionSigner,   // Typed signer for ATC and Algokit Utils
    algodClient          // Algod client for active network (signal)
  } = useWallet()

  return (
    <Show
      when={isReady()}
      fallback={<div>Loading...</div>}
    >
      <Show
        when={activeAddress()}
        fallback={<div>Not connected</div>}
      >
        <div>Connected: {activeAddress()}</div>
      </Show>
    </Show>
  )
}
```

Note that unlike [React's hooks](react.md#using-the-hooks), Solid's primitives return signals (functions) that need to be called to access their current value. The values are automatically tracked and will trigger reactivity when they change.

For a complete list of all available properties and methods, see the [useWallet API Reference](../api-reference/usewallet.md).

#### useNetwork

The `useNetwork` primitive serves two primary functions: managing the active network and supporting runtime node configuration.

```tsx
import { useNetwork } from '@txnlab/use-wallet-solid'

function NetworkSelector() {
  const {
    // Active network management
    activeNetwork,         // Currently active network (signal)
    setActiveNetwork,      // Function to change networks
    
    // Runtime node configuration
    networkConfig,         // Complete configuration for all networks
    activeNetworkConfig,   // Configuration for active network only (signal)
    updateAlgodConfig,     // Update a network's Algod configuration
    resetNetworkConfig     // Reset network config to initial values
  } = useNetwork()

  return (
    <div>
      {/* Example: Network selector dropdown */}
      <select
        value={activeNetwork()}
        onChange={(e) => setActiveNetwork(e.currentTarget.value)}
      >
        <For each={Object.keys(networkConfig())}>
          {(networkId) => (
            <option value={networkId}>
              {networkId}
            </option>
          )}
        </For>
      </select>
    </div>
  )
}
```

Active network management (previously part of `useWallet`) enables users to switch between different networks.

Runtime node configuration, introduced in v4.0.0, enables users to override the application's default node settings and connect to any Algorand node. See the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide for details about implementing this feature.

For a complete list of all available properties and methods, see the [useNetwork API Reference](../api-reference/usenetwork.md).

### Next Steps

* Check out the [Connect Wallet Menu](../guides/connect-wallet-menu.md) guide for creating a simple wallet connection interface
* Learn about transaction signing patterns in the [Signing Transactions](../guides/signing-transactions.md) guide
* Explore network features in the [Switching Networks](../guides/switching-networks.md) and [Runtime Node Configuration](../guides/runtime-node-configuration.md) guides
* Read the [API Reference](broken-reference) for detailed documentation of the library's main exports
* Browse [Example Projects](../resources/example-projects.md) for a working implementation in Vite (Solid)
