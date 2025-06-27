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

# Supported Wallets

Use-wallet supports several popular Algorand wallets. This guide covers the available wallet providers and their configuration options. For complete configuration examples and additional setup details, see the [Installation](installation.md#install-dependencies) and [Configuration](configuration.md#configuring-wallets) guides.

### Production Wallets

#### Pera Wallet

Mobile-first wallet with robust dApp integration features. [Installation instructions](installation.md#pera-wallet).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.PERA

// With optional configuration
{
  id: WalletId.PERA,
  options: {
    shouldShowSignTxnToast?: boolean
    chainId?: number // Defaults to active network
  }
}
```

* [Pera Website](https://perawallet.app)
* [Pera Connect Documentation](https://github.com/perawallet/connect)

#### Defly Wallet

Mobile wallet with advanced DeFi features. [Installation instructions](installation.md#defly-wallet).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.DEFLY

// With optional configuration
{
  id: WalletId.DEFLY,
  options: {
    shouldShowSignTxnToast?: boolean
    chainId?: number // Defaults to active network
  }
}
```

* [Defly Website](https://defly.app)
* [Defly Connect Documentation](https://github.com/blockshake-io/defly-connect)

#### Defly Wallet (Web)

{% hint style="warning" %}
The Defly Web Wallet is currently in beta.
{% endhint %}

Browser extension wallet by Defly, optimized for web interactions. [Installation instructions](installation.md#defly-wallet-web).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.DEFLY_WEB
```

* [Defly Website](https://defly.app)

#### WalletConnect

Universal wallet connection protocol that enables secure communication between mobile wallets and desktop dApps. Supports any wallet that implements the WalletConnect v2 protocol. Project IDs must be obtained from Reown Cloud. [Installation instructions](installation.md#walletconnect).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Configuration required
{
  id: WalletId.WALLETCONNECT,
  options: {
    projectId: string      // Required: Project ID from cloud.reown.com
    relayUrl?: string      // Optional: Custom relay server
    metadata?: {           // Optional: dApp metadata
      name?: string
      description?: string
      url?: string
      icons?: string[]
    }
  }
}
```

* [WalletConnect Network](https://walletconnect.network)
* [Sign API Documentation](https://docs.reown.com/api/sign/dapp-usage)
* [Reown Cloud Dashboard](https://cloud.reown.com/)

#### Lute Wallet

Web and browser extension wallet with Ledger hardware support. [Installation instructions](installation.md#lute-wallet).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.LUTE

// With optional configuration
{
  id: WalletId.LUTE,
  options: {
    siteName?: string // Defaults to document title
  }
}
```

* [Lute Website](https://lute.app)
* [Lute Connect Documentation](https://github.com/GalaxyPay/lute-connect)

#### Kibisis

Browser extension wallet for AVM-compatible chains (Algorand and Voi). [Installation instructions](installation.md#kibisis).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.KIBISIS
```

* [Kibisis Website](https://kibis.is)
* [AVM Web Provider Documentation](https://avm-web-provider.agoralabs.sh)

#### Exodus

Multi-currency wallet with desktop, mobile, and browser extension support.

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.EXODUS

// With optional configuration
{
  id: WalletId.EXODUS,
  options: {
    genesisID?: string    // Network identifier
    genesisHash?: string  // Network hash
  }
}
```

* [Exodus Website](https://www.exodus.com)
* [Exodus Algorand Provider API](https://docs.exodus.com/web3-providers/algorand-provider-arc-api/)

#### Magic Auth

Email-based authentication provider with built-in wallet functionality. [Installation instructions](installation.md#magic-auth).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Configuration required
{
  id: WalletId.MAGIC,
  options: {
    apiKey: string // Required: Magic Auth API key
  }
}
```

* [Magic Website](https://magic.link)
* [Magic Algorand Documentation](https://magic.link/docs/blockchains/other-chains/other/algorand)

#### Biatec

Open-source mobile wallet with community focus and WalletConnect support. [Installation instructions](installation.md#walletconnect).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Basic usage (no options required)
WalletId.BIATEC
```

* [Biatec Website](https://wallet.biatec.io)
* [Biatec GitHub Repository](https://github.com/scholtz/wallet)

#### Liquid Auth (experimental)

 Liquid Auth is a self-hosted authentication service that provides a simple way to associate Passkeys to spending KeyPairs commonly found in cryptocurrencies, in accordance with the FIDO2 WebAuthn specification. In addition to authentication, Liquid Auth provides a Peer to Peer signaling service.
 
 Not only can you authenticate users, you can also establish secure, WebRTC-based connections between a mobile wallet and a desktop dApp. Liquid Auth serves as an alternative to protocols where access is controlled or limited by centralized entities.

 The Liquid Auth wallet provider defaults to `window.origin` as the origin, assuming the Liquid Auth backend is hosted on the same domain. Alternatively, you can specify a custom endpoint.

```typescript
import { WalletId } from '@txnlab/use-wallet'

{
  id: WalletId.LIQUID,
  options: {
      origin?: string,
      RTC_config_username: string,
      RTC_config_credential: string
  }
}
``` 

 The example use cases are configured to use the Algorand Foundation-hosted endpoint at `https://debug.liquidauth.com`, with `liquid-auth` as the username and `sqmcP4MiTKMT4TGEDSk9jgHY` as the credential. This endpoint is suitable for testing but should NOT be used in production environments.


 {% hint style="info" %}
 The Liquid Auth provider is currently experimental and subject to change in future releases. It requires users to have an Android v14+ device or an iOS 17+ device, and for developers to set up a [specific backend](https://liquidauth.com/server/introduction/). For more info, please refer to the [documentation](https://liquidauth.com/guides/getting-started/).
 {% endhint %}

[Liquid Auth documentation](https://liquidauth.com/guides/getting-started/)

### Development Wallets

#### KMD

Development wallet provider for use with Algorand's [`goal`](https://developer.algorand.org/docs/get-details/algokit/features/goal/) CLI tool and [AlgoKit](https://algorand.co/algokit).

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Configuration required
{
  id: WalletId.KMD,
  options: {
    wallet?: string           // Optional: KMD wallet name
    token?: string            // Optional: KMD API token
    baseServer?: string       // Optional: KMD server URL
    port?: string | number    // Optional: KMD server port
    promptForPassword?: () => Promise<string>  // Optional: Custom password prompt
  }
}
```

* [KMD Documentation](https://algorand.github.io/js-algorand-sdk/classes/Kmd.html)

#### Mnemonic Wallet

Simple wallet provider for testing environments.

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Configuration required
{
  id: WalletId.MNEMONIC,
  options: {
    persistToStorage?: boolean          // Optional: Save mnemonic in localStorage
    promptForMnemonic?: () => Promise<string> // Optional: Custom mnemonic prompt
  }
}
```

{% hint style="danger" %}
**Warning:** The Mnemonic Wallet provider is for testing only and will not work on MainNet. Never use with real assets.
{% endhint %}

See the [Testing with Mnemonic Wallet](../guides/testing-with-mnemonic-wallet.md) guide for details about end-to-end (E2E) testing.

### Custom Provider

For integrating unsupported wallets or implementing specialized wallet interactions.

```typescript
import { WalletId } from '@txnlab/use-wallet'

// Configuration required
{
  id: WalletId.CUSTOM,
  options: {
    provider: {
      connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
      disconnect?: () => Promise<void>
      resumeSession?: () => Promise<WalletAccount[] | void>
      signTransactions?: <T>(txnGroup: T | T[], indexesToSign?: number[]) => Promise<(Uint8Array | null)[]>
      transactionSigner?: (txnGroup: Transaction[], indexesToSign: number[]) => Promise<Uint8Array[]>
    }
  }
}
```

See the [Custom Provider](../guides/custom-provider.md) guide for implementation details.
