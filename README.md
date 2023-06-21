# @txnlab/use-wallet

`@txnlab/use-wallet` is a React library that provides a simplified, consistent interface for integrating multiple Algorand wallets into your decentralized applications (dApps).

## Overview

With the `useWallet` hook and utility functions, you can:

- Easily add or remove wallet support with a few lines of code
- Configure each wallet provider as needed for your application
- Allow users to easily switch between active accounts and wallet providers
- Sign and send transactions
- Restore sessions for returning users

This library supports most Algorand wallet providers, including Defly, Pera, Daffi, and Exodus (see [Supported Wallet Providers](#supported-wallet-providers) for the full list).

<!-- It provides an abstraction layer that handles the initialization, connection, and transaction signing logic, eliminating the need to interact with each wallet's individual API. -->

As of version 2.x it includes [WalletConnect 2.0 support](#walletconnect-20-support).

## Table of Contents

- [Live Examples](#live-examples)
- [Installation](#installation)
- [Initializing Providers](#initializing-providers)
- [The `useWallet` Hook](#the-usewallet-hook)
- [Type Definitions](#type-definitions)
- [Connect Menu](#connect-menu)
- [Displaying Account Details](#displaying-account-details)
- [Signing and Sending Transactions](#signing-and-sending-transactions)
- [Checking Connection Status](#checking-connection-status)
- [Supported Wallet Providers](#supported-wallet-providers)
- [Legacy Wallet Support](#legacy-wallet-support)
- [Provider Configuration](#provider-configuration)
  - [Default configuration](#default-configuration)
  - [Node configuration](#node-configuration)
  - [Customize provider support](#customize-provider-support)
  - [Provider objects](#provider-objects)
  - [Static imports](#static-imports)
- [WalletConnect 2.0 Support](#walletconnect-20-support)
- [Migration Guide](#migration-guide)
- [Local Development](#local-development)
- [Used By](#used-by)
- [License](#license)

## Live Examples

**Storybook demo** - https://txnlab.github.io/use-wallet

**Next.js example**

- Demo - https://next-use-wallet.vercel.app/
- Code - https://github.com/TxnLab/next-use-wallet

**NFDomains** - https://app.nf.domains/

## Installation

Since this library uses React Hooks, your app will need to be using React 16.8 or higher.

First, install the library

```bash
npm install @txnlab/use-wallet
```

If you haven't already, install the Algorand JS SDK

```bash
npm install algosdk
```

Finally, install the peer dependencies for the wallets you wish to support. To use the default configuration:

```bash
npm install @perawallet/connect @blockshake/defly-connect @daffiwallet/connect
```

Replace `npm install` with `yarn add` or `pnpm add` in the commands above, depending on your preferred package manager.

## Initializing Providers

In the root of your app, initialize the `WalletProvider` with the `useInitializeProviders` hook.

This example initializes `useWallet` with the default configuration options. See [Provider Configuration](#provider-configuration) for more options.

```jsx
import React from 'react'
import { WalletProvider, useInitializeProviders } from '@txnlab/use-wallet'

export default function App() {
  // default configuration
  const providers = useInitializeProviders()

  return (
    <WalletProvider value={providers}>
      <div className="App">{/* ... */}</div>
    </WalletProvider>
  )
}
```

## The `useWallet` Hook

The `useWallet` hook is used to access wallet provider and account state, send unsigned transactions to be signed, and send signed transactions to the node from anywhere in your app. It returns an object with the following properties:

- `providers` - Array of wallet providers that have been initialized (see `Provider` in [Type Definitions](#type-definitions))
- `activeAccount` - The currently active account in the active provider (see `Account` in [Type Definitions](#type-definitions))
- `connectedAccounts` - Array of accounts from all connected wallet providers
- `connectedActiveAccounts` - Array of accounts from the active wallet provider
- `activeAddress` - The address of `activeAccount`
- `status`, `isReady`, `isActive` - The current connection status, see [Check connection status](#check-connection-status)
- `signTransactions` - Function that sends unsigned transactions to active wallet provider for signature
- `sendTransactions` - Function that sends signed transactions to the node
- `groupTransactionsBySender` - Utility function that groups transactions by sender address
- `getAddress` - Utility function that returns the address of the `activeAccount`
- `getAccountInfo` - Utility function that fetches `activeAccount` account information from the node
- `getAssets` - Utility function that fetches `activeAccount` asset info/balances from the node
- `signer` - Function used by the [KMD](#kmd-algorand-key-management-daemon) provider to sign transactions

## Type Definitions

### `Provider`

```ts
type Provider = {
  accounts: Account[]
  isActive: boolean
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
  setActiveProvider: () => void
  setActiveAccount: (account: string) => void
  metadata: Metadata
}
```

Each provider has two connection states: `isConnected` and `isActive`.

`isConnected` means that the user has authorized the provider in the app. Multiple providers can be connected at the same time.

`isActive` means that the provider is currently active and will be used to sign and send transactions.

### `Account`

```ts
interface Account {
  providerId: PROVIDER_ID
  name: string
  address: string
  authAddr?: string
}
```

The `activeAccount` is the account that will be used to sign and send transactions.

To get the currently active wallet provider, read the `providerId` property of `activeAccount`.

## Connect Menu

In your app's UI you will need a menu for the user to `connect` or `disconnect` wallet providers, `setActiveProvider`, and `setActiveAccount`.

This is a bare-bones example for demonstration purposes. For a styled example, see https://app.nf.domains/

```jsx
import React from 'react'
import { useWallet } from '@txnlab/use-wallet'

export default function ConnectMenu() {
  const { providers, activeAccount } = useWallet()

  // 1. Map over `providers` array
  // 2. Show the provider name/icon and "Connect", "Set Active", and "Disconnect" buttons
  // 3. If active, map `provider.accounts` to render a select menu of connected accounts

  return (
    <div>
      {providers?.map((provider) => (
        <div key={provider.metadata.id}>
          <h4>
            <img
              width={30}
              height={30}
              alt={`${provider.metadata.name} icon`}
              src={provider.metadata.icon}
            />
            {provider.metadata.name} {provider.isActive && '[active]'}
          </h4>

          <div>
            <button type="button" onClick={provider.connect} disabled={provider.isConnected}>
              Connect
            </button>
            <button type="button" onClick={provider.disconnect} disabled={!provider.isConnected}>
              Disconnect
            </button>
            <button
              type="button"
              onClick={provider.setActiveProvider}
              disabled={!provider.isConnected || provider.isActive}
            >
              Set Active
            </button>

            <div>
              {provider.isActive && provider.accounts.length && (
                <select
                  value={activeAccount?.address}
                  onChange={(e) => provider.setActiveAccount(e.target.value)}
                >
                  {provider.accounts.map((account) => (
                    <option key={account.address} value={account.address}>
                      {account.address}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Displaying Account Details

The `activeAccount` object can be used to display details for the currently active account.

```jsx
import React from 'react'
import { useWallet } from '@txnlab/use-wallet'

export default function Account() {
  const { activeAccount } = useWallet()

  if (!activeAccount) {
    return <p>No account active.</p>
  }

  return (
    <div>
      <h4>Active Account</h4>
      <p>
        Name: <span>{activeAccount.name}</span>
      </p>
      <p>
        Address: <span>{activeAccount.address}</span>
      </p>
      <p>
        Provider: <span>{activeAccount.providerId}</span>
      </p>
    </div>
  )
}
```

## Signing and Sending Transactions

Here is an example of a signing and sending simple pay transaction using `signTransactions` and `sendTransactions`.

```jsx
import React from 'react'
import algosdk from 'algosdk'
import {
  useWallet,
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_TOKEN,
  DEFAULT_NODE_PORT
} from '@txnlab/use-wallet'

const algodClient = new algosdk.Algodv2(DEFAULT_NODE_TOKEN, DEFAULT_NODE_BASEURL, DEFAULT_NODE_PORT)

export default function Transact() {
  const { activeAddress, signTransactions, sendTransactions } = useWallet()

  const sendTransaction = async (from?: string, to?: string, amount?: number) => {
    try {
      if (!from || !to || !amount) {
        throw new Error('Missing transaction params.')
      }

      const suggestedParams = await algodClient.getTransactionParams().do()

      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from,
        to,
        amount,
        suggestedParams
      })

      const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction)
      const signedTransactions = await signTransactions([encodedTransaction])
      const waitRoundsToConfirm = 4
      const { id } = await sendTransactions(signedTransactions, waitRoundsToConfirm)

      console.log('Successfully sent transaction. Transaction ID: ', id)
    } catch (error) {
      console.error(error)
    }
  }

  if (!activeAddress) {
    return <p>Connect an account first.</p>
  }

  return (
    <div>
      <button type="button" onClick={() => sendTransaction(activeAddress, activeAddress, 1000)}>
        Sign and send transactions
      </button>
    </div>
  )
}
```

### signTransactions

```jsx
const signTransactions: (
  transactions: Uint8Array[] | Uint8Array[][],
  indexesToSign?: number[],
  returnGroup?: boolean // defaults to true
) => Promise<Uint8Array[]>
```

The `signTransactions` function will accept an array of transactions or an array of transaction groups.

You can optionally specify which transactions should be signed by providing an array of indexes as the second argument, `indexesToSign`.

By setting `returnGroup` to `false`, the returned promise will resolve to an array of signed transactions only. Otherwise it will return flat array of all transactions by default.

### sendTransactions

```jsx
const sendTransactions: (
  signedTransactions: Uint8Array[],
  waitRoundsToConfirm?: number
) => Promise<PendingTransactionResponse & { id: string }>
```

If `signTransactions` is successful, the returned array of transactions can be passed to `sendTransactions` to be sent to the network.

It will wait for confirmation before resolving the promise. Use the optional argument `waitRoundsToConfirm` to indicate how many rounds to wait for confirmation.

The promise will resolve to an object containing the transaction `id` and the [`PendingTransactionResponse`](https://developer.algorand.org/docs/rest-apis/algod/#pendingtransactionresponse) from the Algorand REST API.

## Checking Connection Status

The `isActive` and `isReady` properties can be used to check the status of the wallet providers. The `isActive` property determines whether or not an account is currently active. The `isReady` property indicates whether `use-wallet` has mounted and successfully read the connection status from the providers.

These properties are useful when setting up client side access restrictions, for example, by redirecting a user if no wallet provider `isActive`, as shown below.

```jsx
const { isActive, isReady } = useWallet()

useEffect(() => {
  if (isReady && isActive) {
    allowAccess()
  }

  if (isReady && !isActive) {
    denyAccess()
  }
})
```

## Supported Wallet Providers

### Pera Wallet

- Website - https://perawallet.app/
- Download Pera Mobile - [iOS](https://apps.apple.com/us/app/algorand-wallet/id1459898525) / [Android](https://play.google.com/store/apps/details?id=com.algorand.android)
- Pera Web Wallet - https://web.perawallet.app/
- Pera Connect - https://github.com/perawallet/connect

### Defly Wallet

- Website - https://defly.app/
- Download Defly Wallet - [iOS](https://apps.apple.com/us/app/defly/id1602672723) / [Android](https://play.google.com/store/apps/details?id=io.blockshake.defly.app)
- Defly Connect - https://github.com/blockshake-io/defly-connect

### Daffi Wallet

- Website - https://www.daffi.me/
- Download Daffi Wallet - [iOS](https://apps.apple.com/kn/app/daffiwallet/id1659597876) / [Android](https://play.google.com/store/apps/details?id=me.daffi.daffi_wallet)
- Daffi Connect - https://github.com/RDinitiativ/daffiwallet_connect

### WalletConnect

- Website - https://walletconnect.com/
- Documentation - https://docs.walletconnect.com/
- WalletConnect Cloud - https://cloud.walletconnect.com/
- Web3Modal - https://web3modal.com/

### Exodus Wallet

- Website - https://www.exodus.com/
- Download - https://www.exodus.com/download/

### KMD (Algorand Key Management Daemon)

- Documentation - https://developer.algorand.org/docs/rest-apis/kmd

## Legacy Wallet Support

Support for these wallets will be removed in a future release.

### AlgoSigner

- GitHub - https://github.com/PureStake/algosigner
- EOL Press Release - https://www.algorand.foundation/news/algosigner-support-ending

### MyAlgo

- Website - https://wallet.myalgo.com/home
- FAQ - https://wallet.myalgo.com/home#faq

## Provider Configuration

### Default Configuration

Calling `useInitializeProviders` with no arguments initializes the default supported wallet providers with the default node configuration:

| Key                   | Default Value                                                                  |
| --------------------- | ------------------------------------------------------------------------------ |
| providers             | `[PROVIDER_ID.PERA, PROVIDER_ID.DEFLY, PROVIDER_ID.DAFFI, PROVIDER_ID.EXODUS]` |
| nodeConfig.network    | `'mainnet'`                                                                    |
| nodeConfig.nodeServer | `'https://mainnet-api.algonode.cloud'`                                         |
| nodeConfig.nodeToken  | `''`                                                                           |
| nodeConfig.nodePort   | `443`                                                                          |
| algosdkStatic         | `undefined`                                                                    |

```jsx
import React from 'react'
import { WalletProvider, useInitializeProviders } from '@txnlab/use-wallet'

export default function App() {
  const providers = useInitializeProviders()

  return (
    <WalletProvider value={providers}>
      <div className="App">{/* ... */}</div>
    </WalletProvider>
  )
}
```

### Node configuration

To configure the Algorand node that providers will use to send transactions, you can set the `nodeConfig` property. The `network` property should be specified as `mainnet`, `testnet`, `betanet` or the name of your local development network.

Refer to your wallet providers' documentation to see which networks they support.

```jsx
const providers = await initializeProviders({
  nodeConfig: {
    network: 'testnet',
    nodeServer: 'https://testnet-api.algonode.cloud',
    nodeToken: '',
    nodePort: '443'
  }
})
```

### Customize provider support

You can choose which wallet providers to support by setting the `providers` property to an array of provider IDs or [provider objects](#provider-objects). The example below shows provider IDs being used.

```jsx
// Only initialize Pera and Defly providers
const providers = useInitializeProviders({
  providers: [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY]
})
```

### Provider objects

Some wallet providers have accompanying client libraries that can be configured. You can pass an object to the providers array to set `clientOptions`, as shown below.

```jsx
const providers = useInitializeProviders({
  providers: [
    PROVIDER_ID.DEFLY, // use default options for Defly Connect
    { id: PROVIDER_ID.PERA, clientOptions: { shouldShowSignTxnToast: false } },
    { id: PROVIDER_ID.MYALGO, clientOptions: { disableLedgerNano: false } },
    PROVIDER_ID.EXODUS // Exodus has no client library
  ]
})
```

See each provider's documentation for the available client options.

You will need to use provider objects for [static imports](#static-imports), and for [WalletConnect 2.0](#walletconnect-20) support.

**TypeScript:** The provider objects are type-safe, so your IDE should be able to provide autocomplete suggestions for the client's available options based on the `id` that is set.

### Static Imports

By default, `use-wallet` dynamically imports all of the dependencies for the providers, as well as `algosdk`, to reduce bundle size.

Some React frameworks, like [Remix](https://remix.run/), do not support dynamic imports. To get around this, provider clients can be imported in your application and passed to the provider objects `clientStatic` property.

Set the imported `algosdk` to the `algosdkStatic` root property.

```jsx
import React from 'react'
import algosdk from 'algosdk'
import { PROVIDER_ID, WalletProvider, useInitializeProviders } from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { PeraWalletConnect } from '@perawallet/connect'
import SignClient from '@walletconnect/sign-client'
import { WalletConnectModal } from '@walletconnect/modal'

export default function App() {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      {
        id: PROVIDER_ID.WALLETCONNECT,
        clientStatic: SignClient,
        modalStatic: WalletConnectModal,
        clientOptions: {
          projectId: '<YOUR_PROJECT_ID>',
          metadata: {
            name: 'Example Dapp',
            description: 'Example Dapp',
            url: '#',
            icons: ['https://walletconnect.com/walletconnect-logo.png']
          }
        }
      },
      PROVIDER_ID.EXODUS
    ],
    algosdkStatic: algosdk
  })

  return (
    <WalletProvider value={providers}>
      <div className="App">{/* ... */}</div>
    </WalletProvider>
  )
}
```

## WalletConnect 2.0 Support

`use-wallet` v2 introduces support for WalletConnect 2.0. This is a major upgrade to the WalletConnect protocol, and introduces a number of breaking changes for app developers to contend with.

However, Algorand apps with `use-wallet` will be able to support the new protocol with minimal effort:

1. **Obtain a project ID** - You will need to obtain a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/). This is a simple process, and there is no waiting period. Every app will need its own unique project ID.

2. **Install peer dependencies** - Install `@walletconnect/sign-client` and `@walletconnect/modal`.

3. **Update provider configuration** - You will need to use a provider object to initialize WalletConnect, and pass your `clientOptions` as shown below

```jsx
const providers = useInitializeProviders({
  providers: [
    {
      id: PROVIDER_ID.WALLETCONNECT,
      clientOptions: {
        projectId: '<YOUR_PROJECT_ID>',
        metadata: {
          name: 'Example Dapp',
          description: 'Example Dapp',
          url: '#',
          icons: ['https://walletconnect.com/walletconnect-logo.png']
        }
      }
    }
    // other providers...
  ]
})
```

Since it requires the unique `projectId`, the WalletConnect provider is not initialized by default. This is a change from v1. If you want to support WalletConnect, it must be added to the `providers` array.

See [Migrating to WalletConnect 2.0](#migrating-to-walletconnect-20) below for more information.

### "Module not found" errors in Next.js 13

With the WalletConnect provider initialized in your Next.js 13 app, you may see the error `Module not found: Can't resolve 'lokijs' in...` or similar in local development. To resolve this, add the following to your `next.config.js` file:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding') // list modules in error messages
    return config
  }
  // ...other config
}

module.exports = nextConfig
```

See https://github.com/WalletConnect/walletconnect-monorepo/issues/1908#issuecomment-1487801131

## Migration Guide

Version 2.x is a major version bump, and includes some breaking changes from 1.x.

### initializeProviders

`initializeProviders` is now asynchronous, and must be called from inside a `useEffect` hook.

To simplify this, the `useInitializeProviders` hook is now provided, which calls `initializeProviders` internally. It accepts a single object as an argument.

The providers array should be set as the `providers` property.

```diff
- const providers = initializeProviders([PROVIDER_ID.PERA, PROVIDER_ID.DEFLY])
+ const providers = useInitializeProviders({
+   providers: [PROVIDER_ID.PERA, PROVIDER_ID.DEFLY]
+ })
```

Node configuration should be set as the `nodeConfig` property.

```diff
- const providers = initializeProviders([], {
-   network: 'testnet',
-   nodeServer: 'https://testnet-api.algonode.cloud',
-   nodeToken: '',
-   nodePort: '443'
- })
+ const providers = useInitializeProviders({
+   nodeConfig: {
+     network: 'testnet',
+     nodeServer: 'https://testnet-api.algonode.cloud',
+     nodeToken: '',
+     nodePort: '443'
+   }
+ })
```

See [Provider Configuration](#provider-configuration) for more details.

### shouldShowSignTxnToast

Pera Connect and Defly Connect both have a `shouldShowSignTxnToast` option that is set to `true` by default. `use-wallet` v1 set this to `false` by default, and required setting the option back to `true` to achieve the libraries' default behavior.

In v2 this option is set to `true` by default. If your app has this option explicitly set you can remove it from your configuration. If you wish to disable the toast(s), you must now explicitly set the option to `false`.

```jsx
const providers = useInitializeProviders({
  providers: [
    { id: PROVIDER_ID.DEFLY, clientOptions: { shouldShowSignTxnToast: false } },
    { id: PROVIDER_ID.PERA, clientOptions: { shouldShowSignTxnToast: false } }
    // other providers...
  ]
})
```

### WalletConnect provider

The WalletConnect provider now supports WalletConnect 2.0. To continue supporting this provider, or to add support to your application, you must install the `@walletconnect/sign-client` and `@walletconnect/modal` packages.

```bash
npm install @walletconnect/sign-client @walletconnect/modal
```

The peer dependencies for WalletConnect 1.x should be uninstalled.

```bash
npm uninstall @walletconnect/client @json-rpc-tools/utils algorand-walletconnect-qrcode-modal
```

WalletConnect is no longer initialized by default. To add support for WalletConnect, you must add it to the `providers` array, and pass your `clientOptions` as described in [WalletConnect 2.0 Support](#walletconnect-20-support) above.

## Local Development

### Install dependencies

```bash
yarn install
```

### Demo in Storybook

```bash
yarn dev
```

To develop against a local version of `use-wallet` in your application, do the following:

### Build the library

```bash
yarn build
```

### Symlink the library

In the root of `use-wallet` directory, run:

```bash
yarn link
```

In the root of your application, run:

```bash
yarn link @txnlab/use-wallet
```

### Symlink React

In the root of your application, run:

```bash
cd node_modules/react
yarn link
cd ../react-dom
yarn link
```

In the root of the `use-wallet` directory, run:

```bash
yarn link react react-dom
```

## Used By

Are you using `@txnlab/use-wallet`? We'd love to include your project here. Let us know! [Twitter](https://twitter.com/NFDomains) | [Discord](https://discord.gg/7XcuMTfeZP) | [Email](mailto:admin@txnlab.dev)

- [@algoscan/use-wallet-ui](https://github.com/algoscan/use-wallet-ui)
- [@algoworldnft/algoworld-swapper](https://github.com/algoworldnft/algoworld-swapper)

Full list of [Dependents](https://github.com/TxnLab/use-wallet/network/dependents)

## License

See the [LICENSE](https://github.com/TxnLab/use-wallet/blob/main/LICENSE.md) file for license rights and limitations (MIT)
