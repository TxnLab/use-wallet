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

# useNetwork

The `useNetwork` hook/composable provides access to network-related state and methods from the WalletManager. It enables applications to switch between networks and customize node configurations at runtime.

### Core Functionality

All framework adapters provide access to the same core network state and methods, with framework-specific reactive wrappers.

#### State Properties

```typescript
interface NetworkState {
  // Currently active network ID (e.g., 'mainnet', 'testnet')
  activeNetwork: string

  // Complete network configuration object
  networkConfig: Record<string, NetworkConfig>

  // Configuration for the currently active network
  activeNetworkConfig: NetworkConfig
}

interface NetworkConfig {
  // Algod node configuration
  algod: {
    token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader
    baseServer: string
    port?: string | number
    headers?: Record<string, string>
  }

  // Optional network identifiers
  genesisHash?: string
  genesisId?: string
  isTestnet?: boolean
  caipChainId?: string
}
```

#### Methods

```typescript
interface NetworkMethods {
  // Switch to a different network
  setActiveNetwork(networkId: NetworkId | string): Promise<void>

  // Update Algod configuration for a specific network
  updateAlgodConfig(networkId: string, config: Partial<AlgodConfig>): void

  // Reset network configuration to default values
  resetNetworkConfig(networkId: string): void
}
```

### Framework-Specific Usage

Each framework adapter provides the same functionality with patterns optimized for that framework's ecosystem.

{% tabs %}
{% tab title="React" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-react'

function NetworkComponent() {
  const {
    activeNetwork,          // string
    networkConfig,          // Record<string, NetworkConfig>
    activeNetworkConfig,    // NetworkConfig
    setActiveNetwork,       // (networkId: string) => Promise<void>
    updateAlgodConfig,      // (networkId: string, config: Partial<AlgodConfig>) => void
    resetNetworkConfig      // (networkId: string) => void
  } = useNetwork()

  return (
    <div>
      <div>Current network: {activeNetwork}</div>
      <div>Is testnet: {activeNetworkConfig.isTestnet ? 'Yes' : 'No'}</div>
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup>
import { useNetwork } from '@txnlab/use-wallet-vue'

const {
  activeNetwork,          // Ref<string>
  networkConfig,          // NetworkConfig object
  activeNetworkConfig,   // ComputedRef<NetworkConfig>
  setActiveNetwork,      // (networkId: string) => Promise<void>
  updateAlgodConfig,     // (networkId: string, config: Partial<AlgodConfig>) => void
  resetNetworkConfig     // (networkId: string) => void
} = useNetwork()
</script>

<template>
  <div>
    <div>Current network: {{ activeNetwork }}</div>
    <div>Is testnet: {{ activeNetworkConfig.isTestnet ? 'Yes' : 'No' }}</div>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-solid'

function NetworkComponent() {
  const {
    activeNetwork,          // () => string
    networkConfig,          // () => Record<string, NetworkConfig>
    activeNetworkConfig,    // () => NetworkConfig
    setActiveNetwork,       // (networkId: string) => Promise<void>
    updateAlgodConfig,      // (networkId: string, config: Partial<AlgodConfig>) => void
    resetNetworkConfig      // (networkId: string) => void
  } = useNetwork()

  return (
    <div>
      <div>Current network: {activeNetwork()}</div>
      <div>Is testnet: {activeNetworkConfig().isTestnet ? 'Yes' : 'No'}</div>
    </div>
  )
}
```
{% endtab %}
{% endtabs %}

### Method Details

#### setActiveNetwork

```typescript
setActiveNetwork(networkId: NetworkId | string): Promise<void>
```

Switch to a different network. The method:

* Creates a new Algod client for the target network
* Updates the active network in the store
* Persists the selection to local storage
* Maintains active wallet sessions (if supported by the wallet)

Throws an error if the network ID is not found in the configuration.

#### updateAlgodConfig

```typescript
updateAlgodConfig(networkId: string, config: Partial<AlgodConfig>): void
```

Update the Algod client configuration for a specific network. The method:

* Merges the new configuration with existing settings
* Creates a new Algod client if updating the active network
* Persists the configuration to local storage

Configuration options:

```typescript
interface AlgodConfig {
  // API token or authentication header
  token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader

  // Base URL of the node
  baseServer: string

  // Optional port number
  port?: string | number

  // Optional custom headers
  headers?: Record<string, string>
}
```

#### resetNetworkConfig

```typescript
resetNetworkConfig(networkId: string): void
```

Reset a network's configuration to its default values. The method:

* Restores the original configuration for the specified network
* Creates a new Algod client if resetting the active network
* Removes any custom configuration from local storage

### Error Handling

The methods may throw errors in these situations:

* Invalid network ID passed to `setActiveNetwork`
* Invalid configuration passed to `updateAlgodConfig`
* Network ID not found in configuration when calling `resetNetworkConfig`

### TypeScript Support

Full type definitions are available for all properties and methods. The types are consistent across frameworks, with framework-specific wrappers where needed (e.g., Vue refs, Solid signals).

### See Also

* [Network Switching Guide](../guides/switching-networks.md) - Detailed guide on network management
* [Runtime Node Configuration](../guides/runtime-node-configuration.md) - Guide for customizing node configurations
* [Configuration](../getting-started/configuration.md#network-configuration) - Network configuration documentation
