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

# WalletManager

The WalletManager class is the core of use-wallet, responsible for managing wallet connections, network configurations, and state persistence. It provides a framework-agnostic API that serves as the foundation for the React, Vue, and SolidJS adapters.

### Constructor

```typescript
constructor(config?: WalletManagerConfig)
```

Creates a new WalletManager instance with optional configuration.

#### Parameters

```typescript
interface WalletManagerConfig {
  wallets?: SupportedWallet[]
  networks?: Record<string, NetworkConfig>
  defaultNetwork?: string
  options?: WalletManagerOptions
}
```

* `wallets` - Array of wallet providers to enable (see [Configuration](../getting-started/configuration.md#configuring-wallets) for details)
* `networks` - Custom network configurations (optional, defaults provided)
* `defaultNetwork` - Network to use on first load (optional, defaults to 'testnet')
* `options` - Additional configuration options (optional)

```typescript
interface WalletManagerOptions {
  resetNetwork?: boolean    // Reset to default network on page load
  debug?: boolean           // Enable debug logging
  logLevel?: LogLevel       // Set specific log level
}
```

#### Example

```typescript
import { 
  WalletManager, 
  WalletId,
  NetworkId,
  LogLevel 
} from '@txnlab/use-wallet'

const manager = new WalletManager({
  // Configure wallets
  wallets: [
    WalletId.PERA,
    {
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: 'your-project-id'
      }
    }
  ],

  // Configure networks
  networks: {
    algod: {
      baseServer: 'https://testnet-api.4160.nodely.dev',
      port: '443',
      token: ''
    }
  },
  defaultNetwork: NetworkId.TESTNET, // or just 'testnet'

  // Additional options
  options: {
    debug: true,
    logLevel: LogLevel.INFO
  }
})
```

### Properties

#### algodClient

```typescript
algodClient: algosdk.Algodv2
```

Algod client instance for the active network. Updates automatically when switching networks.

#### activeNetwork

```typescript
activeNetwork: string
```

Currently active network identifier (e.g., 'mainnet', 'testnet').

#### networkConfig

```typescript
networkConfig: Record<string, NetworkConfig>
```

Complete network configuration object containing settings for all networks.

#### activeNetworkConfig

```typescript
activeNetworkConfig: NetworkConfig
```

Configuration object for the currently active network.

#### wallets

```typescript
wallets: BaseWallet[]
```

Array of initialized wallet provider instances.

#### activeWallet

```typescript
activeWallet: BaseWallet | null
```

Currently active wallet provider instance, if any.

#### activeWalletAccounts

```typescript
activeWalletAccounts: WalletAccount[] | null
```

Array of accounts available in the active wallet.

#### activeWalletAddresses

```typescript
activeWalletAddresses: string[] | null
```

Array of addresses available in the active wallet.

#### activeAccount

```typescript
activeAccount: WalletAccount | null
```

Currently active account in the active wallet.

#### activeAddress

```typescript
activeAddress: string | null
```

Address of the currently active account.

#### store

```typescript
store: Store<State>
```

[TanStack Store](https://tanstack.com/store) instance containing wallet state. Used internally by framework adapters.

#### isReady

```typescript
isReady: boolean
```

Whether all wallet providers have completed initialization.

### Methods

#### getWallet

```typescript
getWallet(walletId: WalletId): BaseWallet | undefined
```

Get a specific wallet provider instance by ID.

#### resumeSessions

```typescript
resumeSessions(): Promise<void>
```

Resume previously connected wallet sessions. Called automatically by framework adapters.

#### disconnect

```typescript
disconnect(): Promise<void>
```

Disconnect all connected wallets.

#### setActiveNetwork

```typescript
setActiveNetwork(networkId: NetworkId | string): Promise<void>
```

Switch to a different network.

#### updateAlgodConfig

```typescript
updateAlgodConfig(networkId: string, config: Partial<AlgodConfig>): void
```

Update Algod client configuration for a specific network.

#### resetNetworkConfig

```typescript
resetNetworkConfig(networkId: string): void
```

Reset network configuration to default values.

#### signTransactions

```typescript
signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
  txnGroup: T | T[],
  indexesToSign?: number[]
): Promise<(Uint8Array | null)[]>
```

Sign transactions using the active wallet. Delegates to the active wallet's `signTransactions` method.

#### transactionSigner

```typescript
transactionSigner: algosdk.TransactionSigner
```

Typed transaction signer for use with [AtomicTransactionComposer](https://developer.algorand.org/docs/get-details/atc/). Delegates to the active wallet's `transactionSigner` method.

### Events

The WalletManager includes several event handlers that can be used to track state changes:

#### subscribe

```typescript
subscribe(callback: (state: State) => void): () => void
```

Subscribe to state changes. Returns an unsubscribe function.

```typescript
interface State {
  wallets: WalletStateMap
  activeWallet: WalletId | null
  activeNetwork: string
  algodClient: algosdk.Algodv2
  managerStatus: ManagerStatus
  networkConfig: Record<string, NetworkConfig>
}
```

#### Example

```typescript
const unsubscribe = manager.subscribe((state) => {
  console.log('Active wallet:', state.activeWallet)
  console.log('Active network:', state.activeNetwork)
})

// Later
unsubscribe()
```

### Framework Integration

The WalletManager can be used directly with the `subscribe` method to implement custom reactivity, or through one of the official [framework adapters](broken-reference) that provide hooks/composables for common frameworks:

```tsx
// React
import { WalletProvider } from '@txnlab/use-wallet-react'

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourApp />
    </WalletProvider>
  )
}

// Vue
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'

const app = createApp(App)
app.use(WalletManagerPlugin, managerConfig)

// Solid
import { WalletProvider } from '@txnlab/use-wallet-solid'

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourApp />
    </WalletProvider>
  )
}
```

See these guides for more information:

* [React Integration](../framework/react.md)
* [Vue Integration](../framework/vue.md)
* [SolidJS Integration](../framework/solidjs.md)

The WalletManager's framework-agnostic design makes it possible to create adapters for other frameworks. Community contributions for additional framework adapters (e.g., Svelte, Angular) are welcome!
