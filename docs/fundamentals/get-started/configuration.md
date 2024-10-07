---
description: >-
  How to set up the WalletManager: specifying wallets, network options, and
  Algod client configuration
---

# ⚙️ Configuration

## WalletManager

The `WalletManager` class is responsible for initializing the wallet providers and managing the active wallet, network, and state. It accepts a configuration object with three properties: `wallets`, `network`, and `algod`.

{% hint style="info" %}
**Note:** The following example imports modules from the core library. The same modules are also exported from each of the framework adapters.
{% endhint %}

```typescript
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    WalletId.EXODUS,
    WalletId.KIBISIS,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: '<YOUR_PROJECT_ID>' }
    },
    {
      id: WalletId.MAGIC,
      options: { apiKey: '<YOUR_API_KEY>' }
    },
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    }
  ],
  network: NetworkId.TESTNET
})
```

## wallets

Each wallet you wish to support must be included in the `wallets` array.

To initialize wallets with default options, pass the wallet ID using the `WalletId` enum. To use custom options, pass an object with the `id` and `options` properties.

The options shown above are required and will need to be set in order to support those wallets.

{% hint style="info" %}
WalletConnect's required `projectId` can be obtained by registering your project at [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/)
{% endhint %}

{% hint style="info" %}
Magic's required `apiKey` can be obtained by signing up at [https://dashboard.magic.link/signup](https://dashboard.magic.link/signup)
{% endhint %}

## network

The `network` property is used to set the network for the application. Using the `NetworkId` emum, it can be set to either `BETANET`, `TESTNET`, `MAINNET`, or `LOCALNET`. If unset, the default is `TESTNET`.

The active network is persisted to local storage. If your application supports switching networks, when a user revisits your app or refreshes the page, the active network from the previous session will be restored.

## algod

By default, the `WalletManager`'s algod client instance connects to [Nodely](https://nodely.io/)'s free tier API for public networks, and `http://localhost` for LocalNet. You can override this behavior by passing a custom `algod` configuration.

{% hint style="warning" %}
**Warning:** When dealing with sensitive data like API tokens, it's recommended to use environment variables rather than hardcoding these values. The exact method for handling environment variables will vary depending on your project's framework and build setup.

Please refer to your framework's documentation.
{% endhint %}

If your app's network will not change, simply pass an object with `token`, `baseServer` and `port` properties:

```typescript
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

Or you can pass a mapped object with configurations keyed to `NetworkId` enum values:

```typescript
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
