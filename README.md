# use-wallet v3 (beta)

[![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/TxnLab/use-wallet/v3?filename=packages%2Fuse-wallet%2Fpackage.json&label=version)](https://www.npmjs.com/package/@txnlab/use-wallet?activeTab=versions)
[![GitHub License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/v3/LICENSE.md)

## Overview

`use-wallet` is a TypeScript library that simplifies integrating Algorand wallets into decentralized applications (dApps).

Version 3.x has been rewritten as a framework-agnostic core library that can be used in any JavaScript or TypeScript project. It ships with framework specific adapters for React, Vue, and SolidJS.

### This is a beta release

:warning: The library is currently in beta stage and is not yet recommended for production use. The API is subject to change.

## Installation

Use any NPM package manager to install one of the framework-specific adapters or the standalone core library.

### React

```bash
npm install @txnlab/use-wallet-react@beta
```

Compatible with React v16.8+

### Vue

```bash
npm install @txnlab/use-wallet-vue@beta
```

Compatible with Vue 3

### SolidJS

```bash
npm install @txnlab/use-wallet-solid@beta
```

### Core Library

```bash
npm install @txnlab/use-wallet@beta
```

Compatible with any ES6+ project (TypeScript recommended)

### Wallet SDKs

Some wallets require additional packages to be installed. The following table lists wallet providers and their corresponding packages.

| Wallet Provider | Package(s)                                           |
| --------------- | ---------------------------------------------------- |
| Defly Wallet    | `@blockshake/defly-connect`                          |
| Pera Wallet     | `@perawallet/connect-beta`                           |
| WalletConnect   | `@walletconnect/modal`, `@walletconnect/sign-client` |
| Lute Wallet     | `lute-connect`                                       |
| Magic.link      | `magic-sdk`, `@magic-ext/algorand`                   |
| Kibisis Wallet  | `@agoralabs-sh/avm-web-provider`                     |

## Configuration

The `WalletManager` class is responsible for initializing the wallet providers and managing the active wallet, network, and state. It accepts a configuration object with three properties: `wallets`, `network`, and `algod`.

```ts
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.EXODUS,
    {
      id: WalletId.PERA,
      options: { projectId: '<YOUR_PROJECT_ID>' }
    },
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: '<YOUR_PROJECT_ID>' }
    },
    WalletId.KMD,
    WalletId.KIBISIS,
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    },
    {
      id: WalletId.MAGIC,
      options: { apiKey: '<YOUR_API_KEY>' }
    }
  ],
  network: NetworkId.TESTNET
})
```

#### `wallets` (required)

Each wallet you wish to support must be included in the `wallets` array.

To initialize wallets with default options, pass the wallet ID using the `WalletId` enum. To use custom options, pass an object with the `id` and `options` properties.

> **Note:** Pera and WalletConnect's `projectId` option is required. You can obtain a project ID by registering your application at https://cloud.walletconnect.com/

> **Note:** Magic's required `apiKey` can be obtained by signing up at https://dashboard.magic.link/signup

#### `network` (optional)

The `network` property is used to set the network for the application. Using the `NetworkId` emum, it can be set to either `BETANET`, `TESTNET`, `MAINNET`, or `LOCALNET`. If unset, the default is `TESTNET`.

The active network is persisted to local storage. If your application supports switching networks, when a user revisits your app or refreshes the page, the active network from the previous session will be restored.

#### `algod` (optional)

By default, the `WalletManager`'s algod client instance connects to [AlgoNode](https://algonode.io/api/)'s free (as in 🍺) API for public networks, and `http://localhost` for localnet. You can override this behavior by passing a custom `algod` configuration.

If your app's network will not change, simply pass an object with `token`, `baseServer` and `port` properties:

```ts
const walletManager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET,
  algod: {
    token: '<YOUR_TOKEN>',
    baseServer: '<YOUR_SERVER_URL>',
    port: '<YOUR_PORT>'
  }
})
```

Or you can pass a mapped object configurations keyed to `NetworkId` enum values:

```ts
const walletManager = new WalletManager({
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

## Quick Start (React)

The `useWallet` hook is a React hook that provides access to the `WalletManager` instance and its state. It abstracts the `WalletManager` API and provides a simple interface for building a wallet menu and interacting with the active wallet.

In the root of your application, wrap your app with the `WalletProvider` and pass the `walletManager` instance as a prop.

```tsx
import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import ReactDOM from 'react-dom/client'

// Create a manager instance
const walletManager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET
})

function App() {
  return (
    // Provide the manager to your App
    <WalletProvider manager={walletManager}>
      <MyApp />
    </WalletProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

Now, in any component, you can use the `useWallet` hook to access the wallet manager and its state.

```tsx
import { useWallet } from '@txnlab/use-wallet-react'

function WalletMenu() {
  const { wallets, activeWallet, activeAccount } = useWallet()

  return (
    <div>
      <h2>Wallets</h2>
      <ul>
        {wallets.map((wallet) => (
          <li key={wallet.id}>
            <button onClick={() => wallet.connect()}>{wallet.metadata.name}</button>
          </li>
        ))}
      </ul>

      {activeWallet && (
        <div>
          <h2>Active Wallet</h2>
          <p>{activeWallet.metadata.name}</p>
          <h2>Active Account</h2>
          <p>{activeAccount?.address}</p>
          <button onClick={() => activeWallet.disconnect()}>Disconnect</button>
        </div>
      )}
    </div>
  )
}
```

To sign and send transactions, you can use the manager's `algodClient` instance and the `transactionSigner` provided by the active wallet.

```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import { algosdk } from 'algosdk'

function SendAlgos() {
  const { algodClient, activeAddress, transactionSigner } = useWallet()

  const sendAlgos = async () => {
    const atc = new algosdk.AtomicTransactionComposer()
    const suggestedParams = await algodClient.getTransactionParams().do()

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: '<RECIPIENT_ADDRESS>',
      amount: 15000000,
      suggestedParams
    })

    atc.addTransaction({ txn, signer: transactionSigner })

    await atc.execute(algodClient, 4)
  }

  return <button onClick={sendAlgos}>Buy dev a Lavazza ☕️</button>
}
```

To see fully functioning React examples, check out the [example apps](#example-apps) below.

## Quick Start (Vue)

The Vue adapter is a plugin that injects a `WalletManager` instance into the Vue app's context. It exposes a `useWallet` composable function, which lets you access the wallet manager from anywhere in your app.

In the root of your application, install the plugin with your configuration object.

```ts
import { NetworkId, WalletId, WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

// Install the plugin
app.use(WalletManagerPlugin, {
  wallets: [...],
  network: NetworkId.TESTNET
})

app.mount('#app')
```

Now, in any component you have access the wallet manager and its state via the `useWallet` composable.

```vue
<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'

const { wallets, activeWallet, activeAccount } = useWallet()
</script>

<template>
  <div>
    <h2>Wallets</h2>
    <ul>
      <li v-for="wallet in wallets" :key="wallet.id">
        <button @click="wallet.connect()">{{ wallet.metadata.name }}</button>
      </li>
    </ul>

    <div v-if="activeWallet">
      <h2>Active Wallet</h2>
      <p>{{ activeWallet.metadata.name }}</p>
      <h2>Active Account</h2>
      <p>{{ activeAccount.address }}</p>
      <button @click="activeWallet.disconnect()">Disconnect</button>
    </div>
  </div>
</template>
```

To sign and send transactions, you can use the manager's `algodClient` instance and the `transactionSigner` provided by the active wallet.

```vue
<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'

const { algodClient, activeAddress, transactionSigner } = useWallet()

const sendAlgos = async () => {
  const atc = new algosdk.AtomicTransactionComposer()
  const suggestedParams = await algodClient.getTransactionParams().do()

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: activeAddress,
    to: '<RECIPIENT_ADDRESS>',
    amount: 15000000,
    suggestedParams
  })

  atc.addTransaction({ txn, signer: transactionSigner })

  await atc.execute(algodClient, 4)
}
</script>

<template>
  <button @click="sendAlgos">Buy dev a Lavazza ☕️</button>
</template>
```

To see fully functioning Vue examples, check out the [example apps](#example-apps) below.

## Quick Start (SolidJS)

The `useWallet` function provides access to the `WalletManager` instance and its state. It abstracts the `WalletManager` API and provides a simple interface for building a wallet menu and interacting with the active wallet.

In the root of your application, wrap your app with the `WalletProvider` and pass the `walletManager` instance as a prop.

```tsx
import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-solid'
import { render } from 'solid-js/web'

// Create a manager instance
const walletManager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET
})

function App() {
  return (
    // Provide the manager to your App
    <WalletProvider manager={walletManager}>
      <MyApp />
    </WalletProvider>
  )
}

render(<App />, document.getElementById('root')!)
```

Now, in any component, you can use the `useWallet` hook to access the wallet manager and its state.

```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import { For, Show } from 'solid-js'

function WalletMenu() {
  const { wallets, activeWallet, activeAccount } = useWallet()

  return (
    <div>
      <h2>Wallets</h2>
      <ul>
        <For each={wallets}>
          {(wallet) => (
            <li>
              <button onClick={() => wallet.connect()}>{wallet.metadata.name}</button>
            </li>
          )}
        </For>
      </ul>

      <Show when={activeWallet()}>
        <div>
          <h2>Active Wallet</h2>
          <p>{activeWallet().metadata.name}</p>
          <h2>Active Account</h2>
          <p>{activeAccount()?.address}</p>
          <button onClick={() => activeWallet().disconnect()}>Disconnect</button>
        </div>
      </Show>
    </div>
  )
}
```

To sign and send transactions, you can use the manager's `algodClient` instance and the `transactionSigner` provided by the active wallet.

```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import { algosdk } from 'algosdk'

function SendAlgos() {
  const { algodClient, activeAddress, transactionSigner } = useWallet()

  const sendAlgos = async () => {
    const atc = new algosdk.AtomicTransactionComposer()
    const suggestedParams = await algodClient().getTransactionParams().do()

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: '<RECIPIENT_ADDRESS>',
      amount: 15000000,
      suggestedParams
    })

    atc.addTransaction({ txn, signer: transactionSigner })

    await atc.execute(algodClient, 4)
  }

  return <button onClick={sendAlgos}>Buy dev a Lavazza ☕️</button>
}
```

To see a fully functioning Solid example, check out the [example apps](#example-apps) below.

## Example Apps

The following examples demonstrate how to use the `use-wallet` v3 library in various frameworks.

### React

- [React (Vite)](https://github.com/TxnLab/use-wallet/tree/v3/examples/react-ts)
- [Next.js](https://github.com/TxnLab/use-wallet/tree/v3/examples/nextjs)

### Vue

- [Vue (Vite)](https://github.com/TxnLab/use-wallet/tree/v3/examples/vue-ts)
- [Nuxt](https://github.com/TxnLab/use-wallet/tree/v3/examples/nuxt)

### SolidJS

- [SolidJS (Vite)](https://github.com/TxnLab/use-wallet/tree/v3/examples/solid-ts)
- _SolidStart (coming soon)_

### Core Library

- [Vanilla TypeScript (Vite)](https://github.com/TxnLab/use-wallet/tree/v3/examples/vanilla-ts)

## Custom Provider

If you want to integrate a wallet provider that is not included in the library, or if your application requires any additional custom interactions, you can create a custom provider.

1. Create a new class that implements the `CustomProvider` type

```ts
import { CustomProvider, WalletAccount } from '@txnlab/use-wallet' // Or any framework adapter

class ExampleProvider implements CustomProvider {
  /* Required */
  async connect(args?: Record<string, any>): Promise<WalletAccount[]> {
    // Must return an array of connected accounts
    // Optional `args` parameter can be used to pass any additional configuration
  }

  /* Optional */
  async disconnect(): Promise<void> {
    // Disconnect from the wallet provider, if necessary
  }

  /* Optional */
  async resumeSession(): Promise<WalletAccount[] | void> {
    // Reconnect to the wallet provider when the app mounts, if necessary
    // If an array of accounts is returned, they are checked against the stored accounts
    // The stored accounts are updated if they differ
  }

  /* The two signing methods are optional, but you'll want to define at least one! */

  async signTransactions(
    txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
    indexesToSign?: number[],
    returnGroup?: boolean
  ): Promise<Uint8Array[]> {
    // Sign transactions with the wallet
    // Return signed transactions only or the original group if `returnGroup` is true
  }

  async transactionSigner(
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> {
    // Sign an array of transaction objects with the wallet
    // Return signed transactions only
    // Compatible with algosdk's Atomic Transaction Composer
  }
}
```

2. Add the provider to the `WalletManager` configuration

```ts
const walletManager = new WalletManager({
  wallets: [
    // Include the custom provider in the wallets array
    {
      id: WalletId.CUSTOM,
      options: {
        provider: new ExampleProvider()
      },
      metadata: {
        name: 'Example Wallet'
        icon: 'data:image/svg+xml;base64,...'
      }
    }
  ],
  network: NetworkId.TESTNET
})
```

## WalletManager API

The following API is exposed via the `WalletManager` class instance. The framework adapters abstract the `WalletManager` class and expose a similar API via the `useWallet` function.

```ts
class WalletManager {
  constructor({
    wallets: Array<T | WalletIdConfig<T>>,
    network?: NetworkId,
    algod?: NetworkConfig
  }: WalletManagerConstructor)
}
```

### Public Methods

##### `subscribe(callback: (state: State) => void): (() => void)`

- Subscribes to state changes.

  - `callback`: The function to be executed when state changes.

##### `setActiveNetwork(network: NetworkId): void`

- Sets the active network.

  - `network`: The network to be set as active.

##### `getWallet(walletId: WalletId): BaseWallet | undefined`

- Returns a wallet instance by ID.

  - `walletId`: The ID of the wallet to be retrieved.

##### `resumeSessions(): Promise<void>`

- Re-initializes the connected wallet(s) from persisted storage when the app mounts. Framework adapters handle this automatically.

### Properties

##### `wallets: BaseWallet[]`

- Returns all initialized wallet instances.

##### `activeNetwork: NetworkId`

- Returns the currently active network.

##### `algodClient: algosdk.Algodv2`

- Returns the Algod client for the active network.

##### `activeWallet: BaseWallet | null`

- Returns the currently active wallet instance.

##### `activeWalletAccounts: WalletAccount[] | null`

- Returns accounts of the currently active wallet.

##### `activeWalletAddresses: string[] | null`

- Returns addresses of the currently active wallet's accounts.

##### `activeAccount: WalletAccount | null`

- Returns the currently active account.

##### `activeAddress: string | null`

- Returns the address of the currently active account.

##### `signTransactions: BaseWallet.signTransactions`

- Returns a function that signs transactions from an atomic transaction group with the active wallet. See the [description](#signtransactions) in the `BaseWallet` API below.

##### `transactionSigner: BaseWallet.transactionSigner`

- Returns a typed `TransactionSigner` function that signs transactions from an atomic transaction group with the active wallet. See the [description](#transactionsigner-transactionsigner) in the `BaseWallet` API below.

## BaseWallet API

The `BaseWallet` class is an abstract class that defines the interface for wallet implementations. Wallet providers all extend this class and implement its required methods.

```ts
abstract class BaseWallet {
  constructor({ id, metadata, store, subscribe, getAlgodClient }: WalletConstructor<WalletId>)
}
```

### Public Methods

##### `subscribe(callback: (state: State) => void): (() => void)`

- Subscribes to state changes.

  - `callback`: The function to be executed when state changes.

##### `connect(): Promise<WalletAccount[]>`

- Connects the wallet to the dApp.

##### `disconnect(): Promise<void>`

- Disconnects the wallet from the dApp.

##### `resumeSession(): Promise<void>`

- Re-initializes the connected wallet from persisted storage when the app mounts.

##### `setActive(): void`

- Sets the wallet as the active wallet.

##### `setActiveAccount(account: string): void`

- Sets the active account.

  - `account`: The account address to be set as active.

##### `signTransactions`

- Signs transactions from an atomic transaction group with this wallet. This function accepts an array of either `algosdk.Transaction` objects or their serialized bytes. Transactions can be signed by any connected account in the wallet.

```ts
public signTransactions(
  txnGroup: algosdk.Transaction[] | algosdk.Transaction[][] | Uint8Array[] | Uint8Array[][],
  indexesToSign?: number[],
  returnGroup?: boolean // default: true
): Promise<Uint8Array[]>
```

##### `transactionSigner: TransactionSigner`

- A typed [`TransactionSigner`](https://github.com/algorand/js-algorand-sdk/blob/v2.7.0/src/signer.ts#L7-L18) function that signs transactions from an atomic transaction group with this wallet. It can be used with `AtomicTransactionComposer` - see https://developer.algorand.org/docs/get-details/atc/

```ts
public transactionSigner(
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[]
): Promise<Uint8Array[]>
```

### Properties

##### `id: WalletId`

- The wallet's ID.

##### `metadata: WalletMetadata`

- The wallet's metadata.

##### `name: string`

- The wallet's name (uppercase).

##### `accounts: WalletAccount[]`

- The wallet's accounts.

##### `addresses: string[]`

- The wallet's account addresses.

##### `activeAccount: WalletAccount | null`

- The currently active account.

##### `activeAddress: string | null`

- The currently active account's address.

##### `activeNetwork: NetworkId`

- The currently active network.

##### `isConnected: boolean`

- Indicates whether the wallet is connected.

##### `isActive: boolean`

- Indicates whether the wallet is active.

## License

MIT ©2024 [TxnLab, Inc.](https://txnlab.dev)
