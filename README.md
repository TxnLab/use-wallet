# use-wallet v3 (beta)

[![npm version](https://badge.fury.io/js/%40txnlab%2Fuse-wallet.svg)](https://badge.fury.io/js/%40txnlab%2Fuse-wallet) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`use-wallet` is a TypeScript library that simplifies integrating Algorand wallets into decentralized applications (dApps).

Version 3.x has been rewritten as a framework-agnostic core library that can be used in any JavaScript or TypeScript project. It ships with framework specific adapters for major frameworks (currently React and Vue only, more to come).

### This is a beta release

:warning: The library is currently in beta stage and is not yet recommended for production use. The API is subject to change.

## Installation

Use any NPM package manager to install one of the framework-specific adapters or the standalone core library.

### React

```bash
npm install @txnlab/use-wallet-react
```

Compatible with React v16.8+

### Vue

```bash
npm install @txnlab/use-wallet-vue
```

Compatible with Vue 3

### Core Library

```bash
npm install @txnlab/use-wallet
```

Compatible with any ES6+ project (TypeScript recommended)

### Wallet SDKs

Some wallets require additional packages to be installed. The following table lists wallet providers and their corresponding packages.

| Wallet Provider | Package(s)                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| Defly Wallet    | `@blockshake/defly-connect`                                                  |
| Pera Wallet     | `@perawallet/connect`                                                        |
| WalletConnect   | `@walletconnect/modal`, `@walletconnect/sign-client`, `@walletconnect/types` |
| Lute Wallet     | `lute-connect`                                                               |

## Configuration

The `WalletManager` class is responsible for initializing the wallet providers and managing the active wallet, network, and state. It accepts a configuration object with three properties: `wallets`, `network`, and `algod`.

```ts
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.EXODUS,
    WalletId.PERA,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: '<YOUR_PROJECT_ID>' }
    },
    WalletId.KMD,
    WalletId.KIBISIS,
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    }
  ],
  network: NetworkId.TESTNET
})
```

#### `wallets` (required)

Each wallet you wish to support must be included in the `wallets` array.

To initialize wallets with default options, pass the wallet ID using the `WalletId` enum. To use custom options, pass an object with the `id` and `options` properties.

> **Note:** WalletConnect's `projectId` option is required. You can obtain a project ID by registering your application at https://cloud.walletconnect.com/

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

render(<App />, document.getElementById('root'))
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

## Example Apps

The following examples demonstrate how to use the `use-wallet` v3 library in various frameworks.

### React

- [React](https://github.com/TxnLab/use-wallet/tree/v3/examples/react-ts)
- [Next.js](https://github.com/TxnLab/use-wallet/tree/v3/examples/nextjs)

### Vue

- [Vue](https://github.com/TxnLab/use-wallet/tree/v3/examples/vue-ts)
- [Nuxt](https://github.com/TxnLab/use-wallet/tree/v3/examples/nuxt)

### Core Library

- [Vanilla TypeScript](https://github.com/TxnLab/use-wallet/tree/v3/examples/vanilla-ts)

## WalletManager API

The following API is exposed via the `WalletManager` class instance. The framework adapters abstract the `WalletManager` class and expose a similar API via the `useWallet` hook (React) or composition function (Vue).

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
