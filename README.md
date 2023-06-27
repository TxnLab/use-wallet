![](use-wallet-banner.png)

# UseWallet v2

`@txnlab/use-wallet` is a React library that provides a simplified, consistent interface for integrating multiple Algorand wallets into your decentralized applications (dApps).

[![npm version](https://badge.fury.io/js/%40txnlab%2Fuse-wallet.svg)](https://badge.fury.io/js/%40txnlab%2Fuse-wallet)
![License](https://img.shields.io/github/license/TxnLab/use-wallet)

## Overview

With UseWallet's hooks and utility functions, you can:

- Easily add or remove wallet support with a few lines of code
- Configure each wallet provider as needed for your application
- Allow users to easily switch between active accounts and wallet providers
- Sign and send transactions
- Restore sessions for returning users

It provides an abstraction layer that unifies the initialization, connection, and transaction signing logic, eliminating the need to interact with each wallet's individual API.

UseWallet supports most Algorand wallet providers, including Defly, Pera, Daffi, and Exodus (see [Supported Wallet Providers](#supported-wallet-providers) for the full list).

Version 2.x introduces [WalletConnect 2.0 support](#walletconnect-20-support).

## Table of Contents

- [Live Examples](#live-examples)
- [Requirements](#requirements)
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
  - [Provider Definitions](#provider-definitions)
  - [Node Configuration](#node-configuration)
  - [Algosdk Static Import](#algosdk-static-import)
  - [Full Configuration Example](#full-configuration-example)
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

## Requirements

Since this library uses [React Hooks](https://react.dev/reference/react), your app will need to be using React 16.8 or higher.

## Installation

Commands shown below use `npm install` but you can use `yarn add` or `pnpm add` instead.

First, install the library

```bash
npm install @txnlab/use-wallet
```

If you haven't already, install the Algorand JS SDK

```bash
npm install algosdk
```

Finally, install any peer dependencies for the wallets you wish to support. For example, to support Defly, Pera, and Daffi wallets:

```bash
npm install @blockshake/defly-connect @perawallet/connect @daffiwallet/connect
```

## Initializing Providers

In the root of your app, initialize the `WalletProvider` with the `useInitializeProviders` hook.

This example initializes Defly, Pera, Daffi and Exodus wallet providers. The default node configuration (mainnet via [AlgoNode](https://algonode.io/api/)) is used. See [Provider Configuration](#provider-configuration) for more options.

```jsx
import React from 'react'
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { PeraWalletConnect } from '@perawallet/connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'

export default function App() {
  const providers = useInitializeProviders([
    {
      providers: [
        { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
        { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
        { id: PROVIDER_ID.DAFFI, clientStatic: DaffiWalletConnect }
      ]
    }
  ])

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

The `signTransactions` function will accept an array of transactions (encoded) or an array of transaction groups.

#### Advanced Usage

You can optionally specify which transactions should be signed by providing an array of indexes as the second argument, `indexesToSign`.

By setting `returnGroup` to `false`, the returned promise will resolve to an array of signed transactions only. Otherwise it will return a flat array of all transactions by default.

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

The `isActive` and `isReady` properties can be used to check the status of the wallet providers. The `isActive` property determines whether or not an account is currently active. The `isReady` property indicates whether client has mounted and successfully read the connection status from the wallet providers.

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

### Defly Wallet

- Website - https://defly.app/
- Download Defly Wallet - [iOS](https://apps.apple.com/us/app/defly/id1602672723) / [Android](https://play.google.com/store/apps/details?id=io.blockshake.defly.app)
- Defly Connect - https://github.com/blockshake-io/defly-connect
- Install dependency - `npm install @blockshake/defly-connect`

### Pera Wallet

- Website - https://perawallet.app/
- Download Pera Mobile - [iOS](https://apps.apple.com/us/app/algorand-wallet/id1459898525) / [Android](https://play.google.com/store/apps/details?id=com.algorand.android)
- Pera Web Wallet - https://web.perawallet.app/
- Pera Connect - https://github.com/perawallet/connect
- Install dependency - `npm install @perawallet/connect`

### Daffi Wallet

- Website - https://www.daffi.me/
- Download Daffi Wallet - [iOS](https://apps.apple.com/kn/app/daffiwallet/id1659597876) / [Android](https://play.google.com/store/apps/details?id=me.daffi.daffi_wallet)
- Daffi Connect - https://github.com/RDinitiativ/daffiwallet_connect
- Install dependency - `npm install @daffiwallet/connect`

### WalletConnect

- Website - https://walletconnect.com/
- Documentation - https://docs.walletconnect.com/
- WalletConnect Cloud - https://cloud.walletconnect.com/
- Web3Modal - https://web3modal.com/
- Install dependency - `npm install @walletconnect/modal-sign-html`

### Exodus Wallet

- Website - https://www.exodus.com/
- Download - https://www.exodus.com/download/

### KMD (Algorand Key Management Daemon)

- Documentation - https://developer.algorand.org/docs/rest-apis/kmd

## Legacy Wallet Support

Support for these wallets will be removed in a future release.

### AlgoSigner (deprecated)

- GitHub - https://github.com/PureStake/algosigner
- EOL Press Release - https://www.algorand.foundation/news/algosigner-support-ending

### MyAlgo

- Website - https://wallet.myalgo.com/home
- FAQ - https://wallet.myalgo.com/home#faq
- Install dependency - `npm install @randlabs/myalgo-connect`

## Provider Configuration

The `useInitializeProviders` hook accepts a configuration object with the following properties:

| Key                    | Type                                                                                                     | Default Value                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| providers              | `Array<ProviderDef>`                                                                                     | _required_                             |
| nodeConfig.network     | `string \| undefined`                                                                                    | `'mainnet'`                            |
| nodeConfig.nodeServer  | `string \| undefined`                                                                                    | `'https://mainnet-api.algonode.cloud'` |
| nodeConfig.nodeToken   | `string \| algosdk.AlgodTokenHeader \| algosdk.CustomTokenHeader \| algosdk.BaseHTTPClient \| undefined` | `''`                                   |
| nodeConfig.nodePort    | `string \| number \| undefined`                                                                          | `443`                                  |
| nodeConfig.nodeHeaders | `Record<string, string> \| undefined`                                                                    |                                        |
| algosdkStatic          | `typeof algosdk \| undefined`                                                                            |                                        |

### Provider Definitions

The `providers` property is required, and must include at least one provider definition object. This is how you specify which wallet providers you wish to support in your app.

If a wallet provider has an SDK library dependency, make sure you have installed the package. Then set the provider definition's `clientStatic` property to the dependency's exported module. For example, to use the Defly Wallet provider, you must install the `@blockshake/defly-connect` package and set its `clientStatic` property to `DeflyWalletConnect`.

```jsx
import React from 'react'
import { WalletProvider, useInitializeProviders, PROVIDER_ID } from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'

export default function App() {
  const providers = useInitializeProviders({
    providers: [{ id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect }]
  })

  return (
    <WalletProvider value={providers}>
      <div className="App">{/* ... */}</div>
    </WalletProvider>
  )
}
```

If a provider has options that can be configured, you can set them in the `clientOptions` property. In most cases these would be the options that are passed to the provider's SDK library when it is initialized. See each [supported provider](#supported-wallet-providers)'s documentation for more details.

While most client options are optional, the WalletConnect provider has required `clientOptions` that must be set. See the [WalletConnect 2.0](#walletconnect-20-support) section below for more details.

**TypeScript:** The provider definitions are type-safe, so your IDE should be able to provide autocomplete suggestions for the client's available options based on the `id` that is set.

### Node configuration

To configure the Algorand node that providers will use to send transactions, you can set the `nodeConfig` property. The `network` property should be specified as `mainnet`, `testnet`, `betanet` or the name of your local development network\*.

\* _Refer to each wallet providers' documentation to see which networks they support._

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

### Algosdk Static Import

By default, the providers dynamically import the `algosdk` peer dependency installed in your app, to reduce bundle size.

Some React frameworks, like [Remix](https://remix.run/), do not support dynamic imports. To get around this, you can set the optional `algosdkStatic` root property to the imported `algosdk` module.

```jsx
import React from 'react'
import algosdk from 'algosdk'
import { PROVIDER_ID, WalletProvider, useInitializeProviders } from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'

export default function App() {
  const providers = useInitializeProviders({
    providers: [{ id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect }],
    algosdkStatic: algosdk
  })

  return (
    <WalletProvider value={providers}>
      <div className="App">{/* ... */}</div>
    </WalletProvider>
  )
}
```

### Full Configuration Example

```jsx
import React from 'react'
import algosdk from 'algosdk'
import { PROVIDER_ID, WalletProvider, useInitializeProviders } from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { PeraWalletConnect } from '@perawallet/connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'
import { WalletConnectModalSign } from '@walletconnect/modal-sign-html'

export default function App() {
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
      { id: PROVIDER_ID.DAFFI, clientStatic: DaffiWalletConnect },
      {
        id: PROVIDER_ID.WALLETCONNECT,
        clientStatic: WalletConnectModalSign,
        clientOptions: {
          projectId: '<YOUR_PROJECT_ID>',
          metadata: {
            name: 'Example Dapp',
            description: 'Example Dapp',
            url: '#',
            icons: ['https://walletconnect.com/walletconnect-logo.png']
          },
          modalOptions: {
            themeMode: 'dark'
          }
        }
      },
      { id: PROVIDER_ID.EXODUS }
    ],
    nodeConfig: {
      network: 'mainnet',
      nodeServer: 'https://mainnet-api.algonode.cloud',
      nodeToken: '',
      nodePort: '443'
    }
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

UseWallet v2 introduces support for WalletConnect 2.0. This is a major upgrade to the WalletConnect protocol, and introduces a number of breaking changes for app developers.

However, Algorand apps with UseWallet will be able to support the new protocol with minimal effort:

1. **Obtain a project ID** - You will need to obtain a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/). This is a simple process, and there is no waiting period. Every app will need its own unique project ID.

2. **Install client library** - Install `@walletconnect/modal-sign-html` and set `clientStatic` to the imported `WalletConnectModalSign` module.

3. **Required options** - Set the required `clientOptions` as shown below

```jsx
const providers = useInitializeProviders({
  providers: [
    {
      id: PROVIDER_ID.WALLETCONNECT,
      clientStatic: WalletConnectModalSign,
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

**IMPORTANT:** Only wallets that have been upgraded to support WalletConnect 2.0 will be able to connect to your app with this provider.

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

### useInitializeProviders

The most significant change is how wallet providers are initialized.

`initializeProviders` has been replaced by the `useInitializeProviders` hook. It accepts a single configuration object as an argument. Its properties correspond to the three arguments passed to its predecessor.

The `providers` property is an array of provider definition objects, with an `id` set to a `PROVIDER_ID` constant. Wallet provider SDKs are no longer dynamically imported by their client classes. They must be statically imported and set as the `clientStatic` property.

```diff
- const providers = initializeProviders([PROVIDER_ID.PERA, PROVIDER_ID.DEFLY, PROVIDER_ID.EXODUS])
+ const providers = useInitializeProviders({
+   providers: [
+     { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
+     { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
+     { id: PROVIDER_ID.EXODUS }
+   ]
+ })
```

We've also done away with the concept of "default" providers. Each provider you wish to support in your app must be explicitly defined in the `providers` array.

Node configuration should be set as the `nodeConfig` property.

```diff
- const providers = initializeProviders([...], {
-   network: 'testnet',
-   nodeServer: 'https://testnet-api.algonode.cloud',
-   nodeToken: '',
-   nodePort: '443'
- })
+ const providers = useInitializeProviders({
+   providers: [...],
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

Pera Connect, Defly Connect and Daffi Connect share a `shouldShowSignTxnToast` option that is set to `true` by default. UseWallet v1 set these to `false` by default, and required setting the option back to `true` to achieve the libraries' default behavior.

In v2 this option is set to `true` by default. If your app has this option set to `true` you can remove it from your configuration. If you wish to disable the toast(s), you must now explicitly set the option to `false`.

```jsx
const providers = useInitializeProviders({
  providers: [
    { id: PROVIDER_ID.DEFLY, clientOptions: { shouldShowSignTxnToast: false } },
    { id: PROVIDER_ID.PERA, clientOptions: { shouldShowSignTxnToast: false } },
    { id: PROVIDER_ID.DAFFI, clientOptions: { shouldShowSignTxnToast: false } }
    // other providers...
  ]
})
```

### WalletConnect peer dependencies

The WalletConnect provider now supports WalletConnect 2.0. To continue supporting this provider, or to add support to your application, you must install the `@walletconnect/modal-sign-html` package.

```bash
npm install @walletconnect/modal-sign-html
```

The peer dependencies for WalletConnect 1.x should be uninstalled.

```bash
npm uninstall @walletconnect/client @json-rpc-tools/utils algorand-walletconnect-qrcode-modal
```

See [WalletConnect 2.0 Support](#walletconnect-20-support) for more details.

## Local Development

### Install dependencies

```bash
yarn install
```

### Demo in Storybook

```bash
yarn dev
```

To develop against a local version of `@txnlab/use-wallet` in your application, do the following:

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
