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

# Migrating from v4.x

Version 5.0.0 is a major release that restructures how wallet adapters are packaged and configured:

* Wallet adapters extracted into separate packages for tree-shaking and smaller bundles
* Factory functions replace `WalletId` enum configuration
* ESM-only (CJS build output removed)
* New features: `availableWallets`, `WalletCapabilities`, event emitter, subpath exports

This guide walks you through the changes needed to upgrade from v4.x. The core architecture and framework adapter APIs (`useWallet`, `useNetwork`) are unchanged — most of the migration involves updating imports and wallet configuration.

### Upgrading Dependencies

In v4, you installed a single framework package plus wallet SDKs as peer dependencies:

```bash
# v4 pattern
npm install @txnlab/use-wallet-react algosdk
npm install @perawallet/connect @blockshake/defly-connect lute-connect  # peer deps
```

In v5, wallet SDKs are bundled inside their adapter packages. You install the framework package plus individual wallet adapter packages — no need to install wallet SDKs separately:

```bash
# v5 pattern
npm install @txnlab/use-wallet-react algosdk
npm install @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-lute  # adapter packages
# @perawallet/connect is a dependency of @txnlab/use-wallet-pera — no manual install needed
```

{% hint style="info" %}
Framework packages depend on `@txnlab/use-wallet` (core) directly, so it is installed automatically with them. The wallet adapter packages declare core as a peer dependency, which the explicit `@txnlab/use-wallet` install below satisfies in package managers that don't auto-install peers.
{% endhint %}

1. Update your use-wallet packages:

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet@^5.0.0
# if using React adapter
npm install @txnlab/use-wallet-react@^5.0.0
# if using Vue adapter
npm install @txnlab/use-wallet-vue@^5.0.0
# if using Solid adapter
npm install @txnlab/use-wallet-solid@^5.0.0
# if using Svelte adapter
npm install @txnlab/use-wallet-svelte@^5.0.0
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet@^5.0.0
# if using React adapter
yarn add @txnlab/use-wallet-react@^5.0.0
# if using Vue adapter
yarn add @txnlab/use-wallet-vue@^5.0.0
# if using Solid adapter
yarn add @txnlab/use-wallet-solid@^5.0.0
# if using Svelte adapter
yarn add @txnlab/use-wallet-svelte@^5.0.0
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet@^5.0.0
# if using React adapter
pnpm add @txnlab/use-wallet-react@^5.0.0
# if using Vue adapter
pnpm add @txnlab/use-wallet-vue@^5.0.0
# if using Solid adapter
pnpm add @txnlab/use-wallet-solid@^5.0.0
# if using Svelte adapter
pnpm add @txnlab/use-wallet-svelte@^5.0.0
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet@^5.0.0
# if using React adapter
bun add @txnlab/use-wallet-react@^5.0.0
# if using Vue adapter
bun add @txnlab/use-wallet-vue@^5.0.0
# if using Solid adapter
bun add @txnlab/use-wallet-solid@^5.0.0
# if using Svelte adapter
bun add @txnlab/use-wallet-svelte@^5.0.0
```
{% endtab %}
{% endtabs %}

2. Install wallet adapter packages for the wallets you want to support:

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-lute
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-lute
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-lute
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet-pera @txnlab/use-wallet-defly @txnlab/use-wallet-lute
```
{% endtab %}
{% endtabs %}

3. Remove wallet SDK peer dependencies from your `package.json` — they are now bundled in the adapter packages:

```bash
npm uninstall @perawallet/connect @blockshake/defly-connect lute-connect
```

#### Available Adapter Packages

| Package | Wallet |
|---------|--------|
| `@txnlab/use-wallet-pera` | Pera Wallet |
| `@txnlab/use-wallet-defly` | Defly Wallet |
| `@txnlab/use-wallet-exodus` | Exodus |
| `@txnlab/use-wallet-walletconnect` | WalletConnect (+ skins: Biatec, Voi) |
| `@txnlab/use-wallet-kibisis` | Kibisis |
| `@txnlab/use-wallet-lute` | Lute Wallet |
| `@txnlab/use-wallet-w3wallet` | W3 Wallet |
| `@txnlab/use-wallet-kmd` | KMD (development) |
| `@txnlab/use-wallet-mnemonic` | Mnemonic (testing) |
| `@txnlab/use-wallet-web3auth` | Web3Auth |

{% hint style="info" %}
The **Custom** wallet adapter is built into `@txnlab/use-wallet` core — no separate package needed.
{% endhint %}

### Configuration Changes

This is the most significant breaking change. Wallet configuration moves from a `WalletId` enum-based approach to factory functions imported from individual adapter packages.

#### Before (v4)

```typescript
import { WalletManager, WalletId } from '@txnlab/use-wallet'

const manager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    {
      id: WalletId.LUTE,
      options: { siteName: 'My dApp' }
    },
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: '<YOUR_PROJECT_ID>' }
    }
  ]
})
```

#### After (v5)

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import { lute } from '@txnlab/use-wallet-lute'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

const manager = new WalletManager({
  wallets: [
    pera(),
    defly(),
    lute({ siteName: 'My dApp' }),
    walletConnect({ projectId: '<YOUR_PROJECT_ID>' })
  ]
})
```

Each factory function accepts the same options that were previously passed in the `options` field of the config object. Wallets with no required options are called with no arguments.

#### WalletConnect Skins

WalletConnect skins work the same way, but use the factory function instead of `WalletId`:

**Before (v4):**

```typescript
// Option 1: Dedicated WalletId (deprecated in v4, removed in v5)
{ id: WalletId.BIATEC, options: { projectId: '...' } }

// Option 2: Skin option
{ id: WalletId.WALLETCONNECT, options: { skin: 'biatec', projectId: '...' } }
```

**After (v5):**

```typescript
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

walletConnect({ skin: 'biatec', projectId: '...' })
```

{% hint style="warning" %}
`WalletId.BIATEC` has been removed entirely. Use `walletConnect({ skin: 'biatec', ... })` instead.
{% endhint %}

{% hint style="info" %}
For skinned WalletConnect instances, `wallet.id` has changed: in v4 the id was `'walletconnect'` and only `walletKey` carried the composite value (`'walletconnect:biatec'`). In v5, `wallet.id` and `wallet.walletKey` are both the composite `'walletconnect:biatec'`. Update any code that matches on `wallet.id === 'walletconnect'` for skinned instances.
{% endhint %}

#### Custom Wallet Metadata

To override a wallet's display name or icon, pass a `metadata` option in the factory function's options object — just as in v4:

```typescript
pera({
  metadata: {
    name: 'Custom Name',
    icon: '/path/to/custom-icon.svg'
  }
})
```

{% hint style="info" %}
Exception: the `walletConnect` factory's `metadata` option is WalletConnect's own dApp metadata (name, description, url, icons) sent to the relay — not display metadata. To customize a WalletConnect instance's display name and icon, pass a custom `skin`: `walletConnect({ projectId, skin: { id: 'mywallet', name: 'My Wallet', icon: '...' } })`.
{% endhint %}

### `resetNetwork` Renamed to `persistNetwork`

The `resetNetwork` option has been renamed to `persistNetwork` and its default has been flipped.

**Before (v4):**

```typescript
// Default: resetNetwork: false
// The persisted network from localStorage always overrides defaultNetwork
const manager = new WalletManager({
  defaultNetwork: 'mainnet',
  options: { resetNetwork: true } // Opt-in to ignore persisted network
})
```

**After (v5):**

```typescript
// Default: persistNetwork: false
// The app always starts on defaultNetwork
const manager = new WalletManager({
  defaultNetwork: 'mainnet',
  options: { persistNetwork: true } // Opt-in to remember the user's network choice
})
```

{% hint style="info" %}
If your app uses runtime network switching and you want the user's network choice to persist across sessions, set `persistNetwork: true`. If you don't use network switching, you don't need to change anything — the default behavior now always uses `defaultNetwork` on load.
{% endhint %}

### Type Changes

#### `WalletId`

`WalletId` was an enum in v4. In v5, it is a `string` type. Each adapter package exports its own ID constant:

```typescript
// v4
import { WalletId } from '@txnlab/use-wallet'
const id = WalletId.PERA // enum value

// v5 — if you need a wallet ID string
import { WALLET_ID } from '@txnlab/use-wallet-pera'
// WALLET_ID === 'pera'
```

If your code only uses `WalletId` as a type annotation, string literals will work:

```typescript
// v5
const id: string = 'pera' // valid
```

#### `WalletKey`

In v4, `WalletKey` was a union type:

```typescript
type WalletKey = WalletId | `${WalletId.WALLETCONNECT}:${string}`
```

In v5, it is simply `string`.

#### Data Signing Types

The ARC-60 data signing types have been renamed with a `Std` prefix to match the ARC-60 specification:

* `SignData` → `StdSignData`
* `SignDataResponse` → `StdSignDataResponse`
* `SignMetadata` → `StdSignMetadata`

The `Siwa` request type's `chain_id` field has also changed. In v4 it was the hardcoded literal `'283'`; in v5 it is a `string` that should be set to the [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) chain identifier of the active network, available from `activeNetworkConfig.caipChainId` (e.g. `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` for MainNet).

The `signData(data: string, metadata)` call signature is unchanged. Under the hood, the wallet adapter now constructs the ARC-60 `StdSignData` envelope itself before sending it to the wallet, resolving the signer public key via algod so that rekeyed accounts sign with their auth address. Adapter authors can reuse this logic through the protected `createStdSignData()` method on `BaseWallet`. See the [Signing Data guide](signing-data.md) for a full example.

#### Removed Types

The following types have been removed in v5:

* `SupportedWallet` — replaced by `WalletAdapterConfig`
* `WalletMap`
* `WalletOptionsMap`
* `WalletConfigMap`
* `WalletOptions<T>`
* `WalletIdConfig<T>`

#### New Types

* `WalletAdapterConfig` — the return type of factory functions, passed to `WalletManager`
* `WalletCapabilities` — declares which networks a wallet supports (`supportedNetworks`, `excludedNetworks`)

### Removed Features

#### `webpackFallback` Export

The `webpackFallback` export has been removed. In v4, it provided webpack configuration for dynamic wallet imports. Since v5 uses static imports via factory functions, no webpack configuration is needed.

If your webpack config references `webpackFallback` from `@txnlab/use-wallet`, remove it.

#### `WalletId.BIATEC`

Removed. Use `walletConnect({ skin: 'biatec', projectId: '...' })` from `@txnlab/use-wallet-walletconnect`.

#### `WalletId.MAGIC` (Magic Auth)

Removed. Magic dropped support for Algorand (along with all non-EVM chains except Cosmos and Solana) in July 2026, so the integration no longer functions. If your app relied on Magic for email-based login, consider [Web3Auth](../getting-started/supported-wallets.md#web3auth), which supports email and social login flows.

#### `WalletId.DEFLY_WEB` (Defly Web Wallet)

Removed. The Defly Web Wallet browser extension remained in an unfinished beta that was never published to the Chrome Web Store, and there are no plans for a stable release. The mobile [Defly Wallet](../getting-started/supported-wallets.md#defly-wallet) adapter is unaffected.

#### CJS Build Output

v5 is ESM-only. If your project uses CommonJS (`require()`), you will need to update your build configuration to support ESM imports.

All packages now declare `engines.node >= 22`. Node.js 22+ is required for SSR and tooling environments (browsers are unaffected).

### New Features

#### `availableWallets`

Wallet adapters can declare network capabilities via `WalletCapabilities`. The new `availableWallets` property reactively filters the wallet list based on the active network.

```typescript
// All wallets, regardless of network compatibility
const allWallets = manager.wallets

// Only wallets that support the current network
const available = manager.availableWallets
```

For example, the Mnemonic wallet excludes MainNet for security. When the active network is `'mainnet'`, it won't appear in `availableWallets`.

Related behavior change: when the active network changes, any **connected** wallet that doesn't support the new network is automatically disconnected.

{% hint style="info" %}
`availableWallets` is also available in all framework adapter hooks (`useWallet`). Use it when rendering wallet lists to respect network capabilities.
{% endhint %}

#### Event Emitter

`WalletManager` now provides a typed event emitter for observing wallet lifecycle events:

```typescript
const unsubscribe = manager.on('walletConnected', ({ walletId, accounts }) => {
  console.log(`${walletId} connected with ${accounts.length} accounts`)
})

// Available events:
// ready, walletConnected, walletDisconnected, activeWalletChanged,
// activeAccountChanged, networkChanged, error
// (beforeSign/afterSign signing interception is planned for v5.1+)

// Unsubscribe when done
unsubscribe()
```

#### Subpath Exports

`@txnlab/use-wallet` now provides subpath exports for specialized use cases:

* `@txnlab/use-wallet/adapter` — base classes and utilities for building external wallet adapters
* `@txnlab/use-wallet/testing` — test helpers (`createTestStore`, `createMockAlgodClient`, `createMockStoreAccessor`)

### localStorage Key Change

The persistence key changed from `@txnlab/use-wallet:v4` to `@txnlab/use-wallet:v5`. After upgrading, users will need to reconnect their wallets. This is expected for a major version upgrade.

### Framework Adapter Changes

The framework adapter APIs are **unchanged** in v5. `useWallet()` and `useNetwork()` return the same reactive data and methods. The only change is how `WalletManager` is configured — using factory functions instead of `WalletId` enum values.

Framework-specific setup (providers, plugins, context) remains the same:

{% tabs %}
{% tab title="React" %}
```tsx
import { WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [pera(), defly()],
  defaultNetwork: 'testnet'
})

function App() {
  return (
    <WalletProvider manager={manager}>
      {/* your app */}
    </WalletProvider>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
import { createApp } from 'vue'
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import App from './App.vue'

const app = createApp(App)

app.use(WalletManagerPlugin, {
  wallets: [pera(), defly()],
  defaultNetwork: 'testnet'
})

app.mount('#app')
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { WalletProvider } from '@txnlab/use-wallet-solid'
import { WalletManager } from '@txnlab/use-wallet'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [pera(), defly()],
  defaultNetwork: 'testnet'
})

function App() {
  return (
    <WalletProvider manager={manager}>
      {/* your app */}
    </WalletProvider>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [pera(), defly()],
  defaultNetwork: 'testnet'
})

// Pass manager to WalletProvider component or context
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
`availableWallets` is now available alongside `wallets` in all framework hooks. Use `availableWallets` when rendering wallet lists to respect network capabilities.
{% endhint %}
