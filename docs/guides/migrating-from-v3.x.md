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

# Migrating from v3.x

Version 4.0.0 brings improvements to use-wallet while maintaining the core architecture from v3:

* Updated to support algosdk v3
* Enhanced network configuration capabilities
* Reorganized framework adapter APIs for better separation of concerns

This guide will walk you through the changes needed to upgrade from v3.x. Most applications will require only minor updates to network configuration and imports.

### Upgrading Dependencies

1. Update your use-wallet package:

{% tabs %}
{% tab title="npm" %}
```bash
npm upgrade @txnlab/use-wallet@^4.0.0
# if using React adapter
npm upgrade @txnlab/use-wallet-react@^4.0.0
# if using Vue adapter
npm upgrade @txnlab/use-wallet-vue@^4.0.0
# if using Solid adapter
npm upgrade @txnlab/use-wallet-solid@^4.0.0
# if using Svelte adapter
npm upgrade @txnlab/use-wallet-svelte@^4.0.0
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn upgrade @txnlab/use-wallet@^4.0.0
# if using React adapter
yarn upgrade @txnlab/use-wallet-react@^4.0.0
# if using Vue adapter
yarn upgrade @txnlab/use-wallet-vue@^4.0.0
# if using Solid adapter
yarn upgrade @txnlab/use-wallet-solid@^4.0.0
# if using Svelte adapter
yarn upgrade @txnlab/use-wallet-svelte@^4.0.0
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm update @txnlab/use-wallet@^4.0.0
# if using React adapter
pnpm update @txnlab/use-wallet-react@^4.0.0
# if using Vue adapter
pnpm update @txnlab/use-wallet-vue@^4.0.0
# if using Solid adapter
pnpm update @txnlab/use-wallet-solid@^4.0.0
# if using Svelte adapter
pnpm update @txnlab/use-wallet-svelte@^4.0.0
```
{% endtab %}

{% tab title="bun" %}
```bash
bun update @txnlab/use-wallet@^4.0.0
# if using React adapter
bun update @txnlab/use-wallet-react@^4.0.0
# if using Vue adapter
bun update @txnlab/use-wallet-vue@^4.0.0
# if using Solid adapter
bun update @txnlab/use-wallet-solid@^4.0.0
# if using Svelte adapter
bun update @txnlab/use-wallet-svelte@^4.0.0
```
{% endtab %}
{% endtabs %}

2. Update algosdk:

{% tabs %}
{% tab title="npm" %}
```bash
npm upgrade algosdk@^3.0.0
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn upgrade algosdk@^3.0.0
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm update algosdk@^3.0.0
```
{% endtab %}

{% tab title="bun" %}
```bash
bun update algosdk@^3.0.0
```
{% endtab %}
{% endtabs %}

### Support for algosdk v3

Version 4 upgrades from algosdk v2 to v3. The extent of required changes will depend on how your application uses the SDK. Some applications may need minimal changes, while others may require more extensive updates.

For a complete guide to migrating from algosdk v2 to v3, see the [official migration guide](https://github.com/algorand/js-algorand-sdk/blob/develop/v2_TO_v3_MIGRATION_GUIDE.md).

### Network Configuration Changes

Along with algosdk v3 support, v4 includes improvements to network configuration. The new approach is more flexible and allows configuring custom AVM-compatible networks without modifying the library's codebase.

#### Single Network Configuration

If your application uses a single public Algorand network (MainNet, TestNet, BetaNet), migrate from:

```typescript
const manager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET,
  algod: {
    token: '<YOUR_TOKEN>',
    baseServer: '<YOUR_SERVER_URL>',
    port: '<YOUR_PORT>'
  }
})
```

to:

```typescript
const manager = new WalletManager({
  wallets: [...],
  defaultNetwork: NetworkId.TESTNET, // or just 'testnet'
  networks: {
    testnet: {
      algod: {
        token: '<YOUR_TOKEN>',
        baseServer: '<YOUR_SERVER_URL>',
        port: '<YOUR_PORT>'
      }
    }
  }
})
```

#### Multiple Network Configuration

If your application supports multiple networks, migrate from:

```typescript
const manager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET,
  algod: {
    [NetworkId.TESTNET]: {
      token: '<YOUR_TOKEN>',
      baseServer: '<YOUR_SERVER_URL>',
      port: '<YOUR_PORT>'
    },
    [NetworkId.MAINNET]: {
      token: '<YOUR_TOKEN>',
      baseServer: '<YOUR_SERVER_URL>',
      port: '<YOUR_PORT>'
    }
  }
})
```

to using the `NetworkConfigBuilder`:

```typescript
const networks = new NetworkConfigBuilder()
  .testnet({
    algod: {
      token: '<YOUR_TOKEN>',
      baseServer: '<YOUR_SERVER_URL>',
      port: '<YOUR_PORT>'
    }
  })
  .mainnet({
    algod: {
      token: '<YOUR_TOKEN>',
      baseServer: '<YOUR_SERVER_URL>',
      port: '<YOUR_PORT>'
    }
  })
  .build()

const manager = new WalletManager({
  wallets: [...],
  networks,
  defaultNetwork: NetworkId.TESTNET, // or just 'testnet'
})
```

#### Custom Networks

For other AVM networks (like [Voi](https://voi.network/)), you can use the `NetworkConfigBuilder` and its `addNetwork`method:

```typescript
const networks = new NetworkConfigBuilder()
  .addNetwork('voi-mainnet', {
    algod: {
      token: '',
      baseServer: 'https://mainnet-api.voi.nodely.dev',
      port: ''
    },
    isTestnet: false,
    genesisHash: 'r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=',
    genesisId: 'voimain-v1.0',
    caipChainId: 'algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n'
  })
  .build()

const manager = new WalletManager({
  wallets: [...],
  networks,
  defaultNetwork: 'voi-mainnet'
})
```

See the [Configuration](../getting-started/configuration.md#network-configuration) guide for more details about network configuration options.

### Framework Adapter Changes

Network-related functionality has been moved from `useWallet` to a dedicated `useNetwork` hook:

Before (v3.x):

```typescript
// Network-related returns were part of useWallet
const {
  activeNetwork,
  setActiveNetwork
} = useWallet()
```

After (v4.x):

```typescript
// Now provided by useNetwork
const {
  activeNetwork,
  setActiveNetwork,
  networkConfig,
  activeNetworkConfig,
  updateAlgodConfig,
  resetNetworkConfig
} = useNetwork()
```

If your project supports [network switching](switching-networks.md), you'll need to update your imports and split the network functionality between hooks:

{% tabs %}
{% tab title="React" %}
```tsx
// Before - all functionality from useWallet
import { useWallet } from '@txnlab/use-wallet-react'
const { activeNetwork, setActiveNetwork, /* other wallet returns */ } = useWallet()

// After - network returns moved to useNetwork
import { useWallet, useNetwork } from '@txnlab/use-wallet-react'
const { /* wallet returns */ } = useWallet()
const { activeNetwork, setActiveNetwork } = useNetwork()
```
{% endtab %}

{% tab title="Vue" %}
```typescript
// Before - all functionality from useWallet
import { useWallet } from '@txnlab/use-wallet-vue'
const { activeNetwork, setActiveNetwork, /* other wallet returns */ } = useWallet()

// After - network returns moved to useNetwork
import { useWallet, useNetwork } from '@txnlab/use-wallet-vue'
const { /* wallet returns */ } = useWallet()
const { activeNetwork, setActiveNetwork } = useNetwork()
```
{% endtab %}

{% tab title="Solid" %}
```tsx
// Before - all functionality from useWallet
import { useWallet } from '@txnlab/use-wallet-solid'
const { activeNetwork, setActiveNetwork, /* other wallet returns */ } = useWallet()

// After - network returns moved to useNetwork
import { useWallet, useNetwork } from '@txnlab/use-wallet-solid'
const { /* wallet returns */ } = useWallet()
const { activeNetwork, setActiveNetwork } = useNetwork()
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
// Before - all functionality from useWallet
import { useWallet } from '@txnlab/use-wallet-svelte'
const { activeNetwork, setActiveNetwork, /* other wallet returns */ } = useWallet()

// After - network returns moved to useNetwork
import { useWallet, useNetwork } from '@txnlab/use-wallet-svelte'
const { /* wallet returns */ } = useWallet()
const { activeNetwork, setActiveNetwork } = useNetwork()
```
{% endtab %}
{% endtabs %}
