---
description: Detailed guide for creating and implementing a custom provider
---

# 🧪 Custom Provider

While `@txnlab/use-wallet` supports a wide range of Algorand wallets, you may need to integrate a wallet that isn't included in the library or implement additional custom interactions. The Custom Provider feature allows you to do just that.

## Creating a Custom Provider

To create a custom provider, follow these steps:

1. Create a new class that implements the `CustomProvider` type.
2. Add the provider to the `WalletManager` configuration.

### Step 1: Implement CustomProvider

Create a new class that implements the `CustomProvider` type. This class should include methods for connecting, disconnecting, and signing transactions.

```typescript
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

  async signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> {
    // Sign transactions with the wallet
    // Return array matching length of `txnGroup` with signed transactions or null if unsigned
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

### Step 2: Add to WalletManager Configuration

Once you've created your custom provider, add it to the `WalletManager` configuration:

```typescript
const walletManager = new WalletManager({
  wallets: [
    // Include the custom provider in the wallets array
    {
      id: WalletId.CUSTOM,
      options: {
        provider: new ExampleProvider()
      },
      metadata: {
        name: 'Example Wallet',
        icon: 'data:image/svg+xml;base64,...'
      }
    }
  ],
  network: NetworkId.TESTNET
})
```

## Key Considerations

* The `connect` method is required and must return an array of connected accounts.
* While `disconnect` and `resumeSession` are optional, implementing them can improve the user experience.
* At least one of the signing methods (`signTransactions` or `transactionSigner`) should be implemented to enable transaction signing.
* The `transactionSigner` method is compatible with algosdk's Atomic Transaction Composer, which is the recommended way to handle transactions.

By following these steps, you can create and integrate a custom wallet provider into your application using `@txnlab/use-wallet`. This flexibility allows you to support unique wallet implementations or add custom functionality tailored to your specific needs.
