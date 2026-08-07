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

Use-wallet supports several popular Algorand wallets. This guide covers the available wallet providers and their configuration options. For complete configuration examples and additional setup details, see the [Installation](installation.md#install-wallet-adapters) and [Configuration](configuration.md#configuring-wallets) guides.

### Production Wallets

#### Pera Wallet

Mobile-first wallet with robust dApp integration features.

```typescript
import { pera } from '@txnlab/use-wallet-pera'

// Basic usage (no options required)
pera()

// With optional configuration
pera({
  shouldShowSignTxnToast?: boolean,
  chainId?: number // Defaults to active network
})
```

* [Pera Website](https://perawallet.app)
* [Pera Connect Documentation](https://github.com/perawallet/connect)

#### Defly Wallet

Mobile wallet with advanced DeFi features.

```typescript
import { defly } from '@txnlab/use-wallet-defly'

// Basic usage (no options required)
defly()

// With optional configuration
defly({
  shouldShowSignTxnToast?: boolean,
  chainId?: number // Defaults to active network
})
```

* [Defly Website](https://defly.app)
* [Defly Connect Documentation](https://github.com/blockshake-io/defly-connect)

#### WalletConnect

Universal wallet connection protocol that enables secure communication between mobile wallets and desktop dApps. Supports any wallet that implements the WalletConnect v2 protocol. Project IDs must be obtained from Reown Cloud.

```typescript
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

// Configuration required
walletConnect({
  projectId: string,      // Required: Project ID from cloud.reown.com
  relayUrl?: string,      // Optional: Custom relay server
  metadata?: {            // Optional: dApp metadata
    name?: string,
    description?: string,
    url?: string,
    icons?: string[]
  },
  skin?: string | WalletConnectSkin  // Optional: Skin for branded wallet appearance
})
```

##### WalletConnect Skins

WalletConnect supports "skins" to customize the wallet's appearance for different wallet providers. This allows multiple WalletConnect-based wallets to coexist in the same app with distinct branding.

Built-in skins:
- `'biatec'` - Biatec Wallet
- `'voiwallet'` - Voi Wallet

**Using a built-in skin:**

```typescript
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

// Use the built-in 'biatec' skin
walletConnect({
  skin: 'biatec',
  projectId: '<YOUR_PROJECT_ID>',
})

// Use the built-in 'voiwallet' skin
walletConnect({
  skin: 'voiwallet',
  projectId: '<YOUR_PROJECT_ID>',
})
```

**Using a custom skin at runtime:**

```typescript
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

// Define a custom skin
walletConnect({
  skin: {
    id: 'mywallet',
    name: 'My Wallet',
    icon: 'data:image/svg+xml;base64,...'
  },
  projectId: '<YOUR_PROJECT_ID>',
})
```

**Multiple WalletConnect instances:**

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

const manager = new WalletManager({
  wallets: [
    // Generic WalletConnect (no skin)
    walletConnect({ projectId: '...' }),

    // Biatec-branded WalletConnect
    walletConnect({ projectId: '...', skin: 'biatec' }),

    // Voi Wallet-branded WalletConnect
    walletConnect({ projectId: '...', skin: 'voiwallet' }),

    // Custom wallet skin
    walletConnect({
      projectId: '...',
      skin: { id: 'customwallet', name: 'Custom Wallet', icon: '...' },
    }),
  ]
})

// Access wallets by their unique key
const genericWC = manager.getWallet('walletconnect')
const biatec = manager.getWallet('walletconnect:biatec')
const voiwallet = manager.getWallet('walletconnect:voiwallet')
const custom = manager.getWallet('walletconnect:customwallet')
```

Each skinned WalletConnect instance maintains isolated session storage, allowing users to connect to multiple WalletConnect-based wallets simultaneously.

* [WalletConnect Network](https://walletconnect.network)
* [Sign API Documentation](https://docs.reown.com/api/sign/dapp-usage)
* [Reown Cloud Dashboard](https://cloud.reown.com/)

#### Lute Wallet

Web and browser extension wallet with Ledger hardware support.

```typescript
import { lute } from '@txnlab/use-wallet-lute'

// Basic usage (no options required)
lute()

// With optional configuration
lute({
  siteName?: string // Defaults to document title
})
```

* [Lute Website](https://lute.app)
* [Lute Connect Documentation](https://github.com/GalaxyPay/lute-connect)

#### Kibisis

Browser extension wallet for AVM-compatible chains (Algorand and Voi).

```typescript
import { kibisis } from '@txnlab/use-wallet-kibisis'

// Basic usage (no options required)
kibisis()
```

* [Kibisis Website](https://kibis.is)
* [AVM Web Provider Documentation](https://avm-web-provider.agoralabs.sh)

#### Exodus

Multi-currency wallet with desktop, mobile, and browser extension support.

```typescript
import { exodus } from '@txnlab/use-wallet-exodus'

// Basic usage (no options required)
exodus()

// With optional configuration
exodus({
  genesisID?: string,    // Network identifier
  genesisHash?: string   // Network hash
})
```

* [Exodus Website](https://www.exodus.com)
* [Exodus Algorand Provider API](https://docs.exodus.com/web3-providers/algorand-provider-arc-api/)

#### Web3Auth

Social login authentication provider supporting Google, Facebook, Twitter, Discord, and other OAuth providers. Web3Auth enables users to sign in with familiar social accounts and derive an Algorand wallet from their authentication credentials.

```typescript
import { web3auth } from '@txnlab/use-wallet-web3auth'

// Basic usage with modal (shows social login options)
web3auth({
  clientId: string // Required: from dashboard.web3auth.io
})

// With optional configuration
web3auth({
  clientId: string,               // Required: from dashboard.web3auth.io
  web3AuthNetwork?: string,       // Optional: 'sapphire_mainnet' (default) or 'sapphire_devnet'
  loginProvider?: string,         // Optional: skip modal and use specific provider (e.g., 'google', 'facebook')
  uiConfig?: {                    // Optional: customize modal appearance
    appName?: string,
    logoLight?: string,
    logoDark?: string,
    mode?: 'light' | 'dark' | 'auto'
  }
})
```

Web3Auth-derived accounts support scoped private key access via `withPrivateKey` — see [Using Private Keys Safely](../guides/using-private-keys-safely.md).

**Custom Authentication**

Web3Auth also supports custom authentication flows using Single Factor Auth (SFA), allowing integration with existing authentication systems such as Firebase, Auth0, or custom JWT providers. This approach requires an additional dependency:

```bash
npm install @web3auth/single-factor-auth
```

This advanced use case requires:

- Setting up a custom verifier in the [Web3Auth Dashboard](https://dashboard.web3auth.io)
- Configuring the `verifier` option and `getAuthCredentials` callback
- Managing authentication tokens and passing credentials to the `connect()` method

For implementation details, refer to the [Web3Auth Custom Authentication documentation](https://docs.metamask.io/embedded-wallets/sdk/js/advanced/custom-authentication/).

* [Web3Auth Website](https://web3auth.io)
* [Web3Auth Dashboard](https://dashboard.web3auth.io)
* [Web3Auth Documentation](https://web3auth.io/docs)

#### Voi Wallet

Secure, user-friendly mobile wallet built with React Native for the Voi Network, with Algorand compatibility. Features WalletConnect support for dApp connectivity, airgapped signing for offline transaction signing, and ARC-90 Advanced QR Code Support.

```typescript
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

// Use WalletConnect with the 'voiwallet' skin
walletConnect({
  skin: 'voiwallet',
  projectId: '<REOWN_PROJECT_ID>',
})
```

* [Voi Wallet Website](https://getvera.app)
* [Download for Android](https://play.google.com/store/apps/details?id=com.voinetwork.wallet)
* [Download for iOS](https://apps.apple.com/us/app/voi-wallet/id6752960399)

### Development Wallets

#### KMD

Development wallet provider for use with Algorand's [`goal`](https://developer.algorand.org/docs/get-details/algokit/features/goal/) CLI tool and [AlgoKit](https://algorand.co/algokit).

```typescript
import { kmd } from '@txnlab/use-wallet-kmd'

// Basic usage (no options required)
kmd()

// With optional configuration
kmd({
  wallet?: string,           // Optional: KMD wallet name
  token?: string,            // Optional: KMD API token
  baseServer?: string,       // Optional: KMD server URL
  port?: string | number,    // Optional: KMD server port
  promptForPassword?: () => Promise<string>  // Optional: Custom password prompt
})
```

* [KMD Documentation](https://algorand.github.io/js-algorand-sdk/classes/Kmd.html)

#### Mnemonic Wallet

Simple wallet provider for testing environments.

```typescript
import { mnemonic } from '@txnlab/use-wallet-mnemonic'

// Basic usage (no options required)
mnemonic()

// With optional configuration
mnemonic({
  persistToStorage?: boolean,          // Optional: Save mnemonic in localStorage
  promptForMnemonic?: () => Promise<string> // Optional: Custom mnemonic prompt
})
```

{% hint style="danger" %}
**Warning:** The Mnemonic Wallet provider is for testing only and will not work on MainNet. Never use with real assets.
{% endhint %}

See the [Testing with Mnemonic Wallet](../guides/testing-with-mnemonic-wallet.md) guide for details about end-to-end (E2E) testing. The Mnemonic wallet also supports scoped private key access via `withPrivateKey` — see [Using Private Keys Safely](../guides/using-private-keys-safely.md).

#### W3 Wallet

Multi-currency wallet with desktop, mobile, and browser extension support.

```typescript
import { w3wallet } from '@txnlab/use-wallet-w3wallet'

// Basic usage (no options required)
w3wallet()
```

* [W3 Wallet Website](https://w3wallet.app)

### Custom Provider

For integrating unsupported wallets or implementing specialized wallet interactions.

```typescript
import { custom } from '@txnlab/use-wallet'

// Configuration required
custom({
  provider: {
    connect: (args?: Record<string, any>) => Promise<WalletAccount[]>,
    disconnect?: () => Promise<void>,
    resumeSession?: () => Promise<WalletAccount[] | void>,
    signTransactions?: <T>(txnGroup: T | T[], indexesToSign?: number[]) => Promise<(Uint8Array | null)[]>,
    transactionSigner?: (txnGroup: Transaction[], indexesToSign: number[]) => Promise<Uint8Array[]>,
    signData?: (data: string, metadata: StdSignMetadata) => Promise<StdSignDataResponse>
  }
})
```

See the [Custom Provider](../guides/custom-provider.md) guide for implementation details.

### Third-Party Adapters

Because v5 wallet adapters are standalone packages, wallet providers can publish and maintain their own adapters — they work with use-wallet without requiring changes to this repository. Adapters that meet the [listing criteria](../resources/third-party-adapters.md) are listed here alongside the first-party wallets.

#### AlgoVoi Wallet

ARC-0027 browser wallet for the Algorand and Voi networks, maintained by the AlgoVoi team ([source](https://github.com/chopmob-cloud/use-wallet-algovoi)).

```typescript
import { algovoi } from '@algovoi/use-wallet-algovoi'

// Basic usage (no options required)
algovoi()
```

* [npm package](https://www.npmjs.com/package/@algovoi/use-wallet-algovoi)

_To submit your own adapter for listing, see [Third-Party Adapters](../resources/third-party-adapters.md)._

{% hint style="info" %}
Third-party adapters are developed and maintained by their respective teams. TxnLab reviews adapters against the [listing criteria](../resources/third-party-adapters.md#listing-criteria) at the time of listing, but does not audit subsequent releases — a listing is not an endorsement or a guarantee of security or functionality. Always evaluate any adapter, including reviewing its source code, before using it in your application.
{% endhint %}
