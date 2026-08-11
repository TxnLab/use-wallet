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

# Switching Networks

use-wallet provides two ways to switch between Algorand networks:

* Setting the default network at startup
* Switching networks at runtime using the `useNetwork` hook/composable/primitive

### Default Network

When initializing the WalletManager, you can specify which network to use as the default:

```typescript
import { WalletManager, NetworkId } from '@txnlab/use-wallet'

const manager = new WalletManager({
  defaultNetwork: NetworkId.TESTNET
})
```

You can also control whether the manager should persist the active network across page loads using the `persistNetwork` option:

```typescript
const manager = new WalletManager({
  defaultNetwork: NetworkId.TESTNET,
  options: {
    // Restore the last active network from localStorage on page load
    persistNetwork: true
  }
})
```

When `persistNetwork` is `false` (the default), use-wallet will always reset to `defaultNetwork` on page load. Set `persistNetwork: true` for apps with runtime network switching that should remember the user's last network.

### Runtime Network Switching

The `useNetwork` hook/composable provides methods for switching networks at runtime.

{% tabs %}
{% tab title="React" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-react'

function NetworkSwitch() {
  const {
    activeNetwork,
    setActiveNetwork,
    networkConfig
  } = useNetwork()

  return (
    <select
      value={activeNetwork}
      onChange={(e) => setActiveNetwork(e.target.value)}
    >
      {Object.entries(networkConfig).map(([id, network]) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-vue'

  const {
    activeNetwork,
    setActiveNetwork,
    networkConfig
  } = useNetwork()
</script>

<template>
  <select
    :value="activeNetwork"
    @change="(e) => setActiveNetwork((e.target as HTMLSelectElement).value)"
  >
    <option
      v-for="[id, network] in Object.entries(networkConfig)"
      :key="id"
      :value="id"
    >
      {{ id }}
    </option>
  </select>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-solid'

function NetworkSwitch() {
  const {
    activeNetwork,
    setActiveNetwork,
    networkConfig
  } = useNetwork()

  return (
    <select
      value={activeNetwork()}
      onChange={(e) => setActiveNetwork(e.currentTarget.value)}
    >
      {Object.entries(networkConfig()).map(([id, network]) => (
        <option value={id}>
          {id}
        </option>
      ))}
    </select>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-svelte'

  const {
    activeNetwork,
    setActiveNetwork,
    networkConfig
  } = useNetwork()
</script>

<select
  value={activeNetwork.current}
  onchange={(e) => setActiveNetwork((e.target as HTMLSelectElement).value)}
>
  {#each Object.entries(networkConfig) as [id, network]}
    <option>
      {id}
    </option>
  {/each}
</select>
```
{% endtab %}
{% endtabs %}

### Network Status

You can use the `activeNetworkConfig` to access information about the current network:

{% tabs %}
{% tab title="React" %}
```typescript
const { activeNetworkConfig } = useNetwork()

// Check if we're on a test network
const isTestnet = activeNetworkConfig.isTestnet

// Get genesis ID
const genesisId = activeNetworkConfig.genesisId
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  const { activeNetworkConfig } = useNetwork()

  // Check if we're on a test network
  const isTestnet = computed(() => activeNetworkConfig.value.isTestnet)

  // Get genesis ID
  const genesisId = computed(() => activeNetworkConfig.value.genesisId)
</script>
```
{% endtab %}

{% tab title="Solid" %}
```typescript
const { activeNetworkConfig } = useNetwork()

// Check if we're on a test network
const isTestnet = () => activeNetworkConfig().isTestnet

// Get genesis ID
const genesisId = () => activeNetworkConfig().genesisId
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  const { activeNetworkConfig } = useNetwork()

  // Check if we're on a test network
  const isTestnet = $derived(activeNetworkConfig.current.isTestnet)

  // Get genesis ID
  const genesisId = $derived(activeNetworkConfig.current.genesisId)
</script>
```
{% endtab %}
{% endtabs %}

### Network Events

When switching networks, several things happen automatically:

1. The `algodClient` is updated to point to the new network
2. Connected wallets that don't support the new network (per their declared capabilities) are automatically disconnected; other wallet sessions are maintained
3. A `networkChanged` event is emitted
4. If `persistNetwork` is enabled, the active network is saved to local storage and restored on the next page load

### Wallet Compatibility

Not all wallets support all networks. For example:

* Exodus only works on MainNet
* Defly and Pera only support MainNet and TestNet
* The Mnemonic wallet only works on test networks
* KMD only works on LocalNet
* Custom networks may not be supported by all wallets

Wallets can declare which networks they support using `WalletCapabilities`. The `availableWallets` property (available on `WalletManager` and all framework hooks) returns only wallets compatible with the active network. Consider using `availableWallets` instead of `wallets` when rendering wallet selection lists.

### Default Networks

use-wallet supports any AVM-compatible network and comes with default configurations for these Algorand networks:

* MainNet
* TestNet
* BetaNet
* FNet
* LocalNet (for development)

For details about configuring networks, including how to customize default networks and add custom networks, see the [Configuration](../getting-started/configuration.md#network-configuration) guide.
