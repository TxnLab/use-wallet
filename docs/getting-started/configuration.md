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

# Configuration

The `WalletManager` class is the core of use-wallet, responsible for managing wallet connections and network configurations. This guide covers how to configure the WalletManager for your application.

### Basic Configuration

The `WalletManager` constructor accepts a configuration object with the following structure:

```typescript
interface WalletManagerConfig {
  wallets?: SupportedWallet[]      // Array of wallets to enable
  networks?: Record<string, NetworkConfig>  // Custom network configurations
  defaultNetwork?: string          // Network to use by default
  options?: WalletManagerOptions   // Additional options
}
```

Here's a basic example:

```typescript
import { WalletManager, WalletId, NetworkId } from '@txnlab/use-wallet'

const manager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY],
  defaultNetwork: NetworkId.MAINNET // or just 'mainnet'
})
```

### Configuring Wallets

The `wallets` array determines which wallets will be available in your application. For each wallet, you can provide either:

* Just the wallet identifier (for wallets with no required options)
* A configuration object specifying required options and optional customizations

Some wallets require specific options to be provided. TypeScript will show errors if these required options are omitted or if you try to use just the identifier.

Here's an example showing common wallet configurations, including popular production wallets and those that require specific options:

```typescript
import {
  WalletManager,
  WalletId
} from '@txnlab/use-wallet'

const manager = new WalletManager({
  wallets: [
    // Wallets that can be used without configuration
    WalletId.PERA,
    WalletId.EXODUS,
    WalletId.KIBISIS,
    WalletId.LUTE,
    WalletId.W3_WALLET,
    
    // Example of a wallet with optional customizations
    {
      id: WalletId.DEFLY,
      options: {
        shouldShowSignTxnToast: false
      },
      metadata: {
        name: 'Custom Defly Name',
        icon: '/path/to/custom-icon.svg'
      }
    },
    
    // Wallets that require specific options
    {
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: '<REOWN_PROJECT_ID>'  // Required
      }
    },
    {
      id: WalletId.MAGIC,
      options: {
        apiKey: '<MAGIC_API_KEY>'  // Required
      }
    },

    // WalletConnect with skin (for branded wallet appearance)
    {
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: '<REOWN_PROJECT_ID>', // Required
        skin: 'biatec'  // Built-in skin for Biatec Wallet
      }
    }
  ]
})
```

See the [Supported Wallets](supported-wallets.md) page for details about all wallets available in the library, including those used for development and testing.

### Network Configuration

By default, use-wallet comes with configurations for:

* MainNet
* TestNet
* BetaNet
* LocalNet (for development)

For all public Algorand networks (MainNet, TestNet, BetaNet), the default configurations use [Nodely's free public API](https://nodely.io/docs/free/start/), so you don't need to configure network settings to get started.

{% hint style="info" %}
[Nodely](https://nodely.io/) provides their public API free of charge with [certain usage requirements](https://nodely.io/docs/free/policy/). For production applications with significant traffic, consider either:

* Using Nodely's [unlimited tier](https://nodely.io/docs/unlimited/start/) services
* Connecting to your own node
{% endhint %}

If you need to use a different node or connect to other AVM-compatible networks, you can customize the network configuration in one of two ways:

#### Direct Network Configuration

For applications using a single network, you can provide the configuration directly:

```typescript
import { WalletManager } from '@txnlab/use-wallet'

// Example using environment variables
const network = process.env.ALGOD_NETWORK || 'testnet'

const manager = new WalletManager({
  wallets: [...],
  defaultNetwork: network,
  networks: {
    [network]: {
      algod: {
        baseServer: process.env.ALGOD_SERVER!,
        port: process.env.ALGOD_PORT!,
        token: process.env.ALGOD_TOKEN!,
      }
    }
  }
})
```

This approach is particularly useful when the network configuration comes from environment variables.

#### Using NetworkConfigBuilder

For applications that support multiple networks with custom configurations, the `NetworkConfigBuilder` class provides a convenient, fluent interface:

```typescript
import { 
  WalletManager,
  NetworkConfigBuilder,
  NetworkId
} from '@txnlab/use-wallet'

// Customize Algorand networks
const networks = new NetworkConfigBuilder()
  .testnet({
    algod: {
      baseServer: 'https://your-testnet-node.com',
      port: '443',
      token: 'your-token'
    }
  })
  .mainnet({
    algod: {
      baseServer: 'https://your-mainnet-node.com',
      port: '443',
      token: 'your-token'
    }
  })
  .build()

const manager = new WalletManager({
  wallets: [...],
  networks,
  defaultNetwork: NetworkId.TESTNET // or just 'testnet'
})
```

#### Custom Networks

To add configurations for other AVM-compatible networks, use the `addNetwork` method:

```typescript
import { 
  WalletManager,
  NetworkConfigBuilder
} from '@txnlab/use-wallet'

// Add other AVM-compatible networks
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
  .addNetwork('voi-testnet', {
    algod: {
      token: '',
      baseServer: 'https://testnet-api.voi.nodely.dev',
      port: ''
    },
    isTestnet: true,
    genesisHash: 'IXnoWtviVVJW5LGivNFc0Dq14V3kqaXuK2u5OQrdVZo=',
    genesisId: 'voitest-v1'
  })
  .build()

const manager = new WalletManager({
  wallets: [...],
  networks,
  defaultNetwork: 'voi-testnet'
})
```

When adding a custom network, in addition to setting the Algod configuration (`token`, `baseServer`, `port`), you should also set the [optional properties](configuration.md#optional-properties) that are used by the specific wallet providers you want to support.

### Network Configuration Details

Each network configuration consists of required Algod client settings and optional network identifiers. For the public Algorand networks (MainNet, TestNet, BetaNet), use-wallet provides default configurations with all necessary properties pre-configured.

Most users will only need to customize the Algod client settings:

```typescript
interface NetworkConfig {
  // Required: Algod client configuration
  algod: {
    token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader
    baseServer: string
    port?: string | number
    headers?: Record<string, string>
  }
  
  // Optional: Network identifiers (only needed for custom networks)
  genesisHash?: string    // Network genesis hash
  genesisId?: string      // Network genesis ID
  isTestnet?: boolean     // Whether network is a testnet
  caipChainId?: string    // CAIP-2 chain ID for WalletConnect
}
```

#### Algod Configuration

The `token` property can be provided in several formats:

```typescript
// Simple string token
token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

// AlgodTokenHeader
token: { 'X-Algo-API-Token': 'your-token' }

// CustomTokenHeader
token: { 'Custom-Header-Name': 'your-token' }
```

Most applications will use either a string token or an `AlgodTokenHeader`.

The remaining Algod client settings include:

* `baseServer`: The URL of the Algod node you want to connect to.
* `port`: The port number the Algod node is listening on. Common values include '443' for HTTPS connections and '4001' for local development. Some hosting providers may use different ports.
* `headers`: Optional additional HTTP headers to include with requests.

{% hint style="info" %}
**Note:** Starting with v4.0.0, use-wallet supports user-customizable node settings at runtime. If your application implements the necessary UI components, users can override the configured Algod settings to connect to a different node.

See the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide for details.
{% endhint %}

#### Optional Properties

The optional network properties are only needed when defining [custom networks](configuration.md#custom-networks). They serve specific purposes for different wallet providers:

* `genesisHash`: Required by [Kibisis Wallet](supported-wallets.md#kibisis) during initialization
* `genesisId`: Required by [Lute Wallet](supported-wallets.md#lute-wallet) during initialization
* `isTestnet`: Used by the [Mnemonic Wallet](supported-wallets.md#mnemonic-wallet) provider (which only works on test networks for security)
* `caipChainId`: Required by [WalletConnect](supported-wallets.md#walletconnect) when connecting and signing transactions (see ChainAgnostic [CAIP-2 specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md))

For example, when adding a custom network:

```typescript
const networks = {
  'custom-network': {
    algod: {
      token: 'your-token',
      baseServer: 'https://custom-node.example.com',
      port: '443'
    },
    // Optional properties needed for custom networks
    genesisHash: 'your-network-genesis-hash',
    genesisId: 'custom-net-v1.0',
    isTestnet: true,
    caipChainId: 'algorand:your-network-identifier'
  }
}
```

If any of these optional properties are missing when required by a wallet, use-wallet will attempt to fetch them from the node (for `genesisHash` and `genesisId`) or use sensible defaults (setting `isTestnet` to false).

However, providing them in your configuration can save network requests and ensure proper wallet functionality.

### Manager Options

The optional `options` object allows you to configure the WalletManager's behavior:

```typescript
import { 
  WalletManager,
  LogLevel 
} from '@txnlab/use-wallet'

const manager = new WalletManager({
  // ...
  options: {
    // Reset to default network on page load
    resetNetwork: true,
    
    // Enable debug logging
    debug: true,
    
    // Or set a specific log level
    logLevel: LogLevel.INFO
  }
})
```

### Complete Example

Here's a complete configuration example combining all the elements:

```typescript
import { 
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
  NetworkId,
  LogLevel
} from '@txnlab/use-wallet'

// Configure networks
const networks = new NetworkConfigBuilder()
  .testnet({
    algod: {
      baseServer: 'https://testnet-api.algonode.cloud',
      port: '443',
      token: ''
    }
  })
  .localnet({
    algod: {
      baseServer: 'http://localhost',
      port: '4001',
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    }
  })
  .build()

// Create manager instance
const manager = new WalletManager({
  // Configure wallets
  wallets: [
    WalletId.DEFLY,
    {
      id: WalletId.PERA,
      options: {
        shouldShowSignTxnToast: false
      }
    }
  ],
  
  // Use custom network configurations
  networks,
  defaultNetwork: NetworkId.TESTNET,
  
  // Set manager options
  options: {
    debug: true,
    logLevel: LogLevel.INFO,
    resetNetwork: false
  }
})
```

### Next Steps

The configuration options described in this guide apply to all framework adapters. However, each framework has its own specific setup steps for integrating the configured `WalletManager` into your application. See the framework-specific guides for detailed setup instructions:

* [React](../framework/react.md)
* [Vue](../framework/vue.md)
* [SolidJS](../framework/solidjs.md)
* [Svelte](../framework/svelte.md)
