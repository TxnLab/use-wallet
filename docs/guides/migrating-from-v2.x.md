---
description: Guide for migrating your existing project from use-wallet v2 to v3
---

# 🚣 Migrating from v2.x

The release of `@txnlab/use-wallet` v3.x marks a significant evolution of the library, transitioning from a React-specific solution to a framework-agnostic core with framework-specific adapters. While we've strived to maintain familiarity and ease of use, there are several important changes to be aware of when upgrading from v2.x.

This guide will walk you through the key differences and provide step-by-step instructions to help you migrate your existing React projects to the new version. By following this guide, you'll be able to take advantage of the improved flexibility and expanded capabilities of v3.x while minimizing disruption to your existing codebase.

## Step 1: Update Package Installation

{% hint style="info" %}
Commands are provided for NPM, Yarn, and PNPM
{% endhint %}

The first step in migrating to v3.x is to update your package installation. In v3.x, the core functionality has been separated from the React-specific implementation.

1. Uninstall the existing package:

```sh
npm uninstall @txnlab/use-wallet
```

```bash
yarn remove @txnlab/use-wallet
```

```bash
pnpm remove @txnlab/use-wallet
```

2. Install the new React adapter package:

```bash
npm install @txnlab/use-wallet-react
```

```bash
yarn add @txnlab/use-wallet-react
```

```bash
pnpm add @txnlab/use-wallet-react
```

This new package includes both the core library and the React-specific adapter, ensuring compatibility with your existing React project.

## Step 2: Update Library Configuration

In v3.x, the way you configure the library at the root level of your app has changed. The custom hook `useInitializeProviders` is no longer used, and the configuration is now done outside of the root component using a `WalletManager` instance.

### v2.x Configuration (Old)

```jsx
import React from 'react'
import {
  NetworkId,
  PROVIDER_ID,
  WalletProvider,
  useInitializeProviders,
} from '@txnlab/use-wallet'
import { DeflyWalletConnect } from '@blockshake/defly-connect'
import { PeraWalletConnect } from '@perawallet/connect'
import { DaffiWalletConnect } from '@daffiwallet/connect'
import LuteConnect from 'lute-connect'

function App() {
  // Initialize providers with custom hook
  const providers = useInitializeProviders({
    providers: [
      { id: PROVIDER_ID.DEFLY, clientStatic: DeflyWalletConnect },
      { id: PROVIDER_ID.PERA, clientStatic: PeraWalletConnect },
      { id: PROVIDER_ID.EXODUS },
      {
        id: PROVIDER_ID.LUTE,
        clientStatic: LuteConnect,
        clientOptions: { siteName: '<YOUR_SITE_NAME>' }
      },
      { id: PROVIDER_ID.KIBISIS },
    ],
    network: NetworkId.TESTNET,
  })

  return (
    // Pass the providers to WalletProvider
    <WalletProvider value={providers}>
      <MyApp />
    </WalletProvider>
  )
}
```

### v3.x Configuration (New)

```jsx
import React from 'react'
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider
} from '@txnlab/use-wallet-react'

// Create a WalletManager instance
const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    WalletId.EXODUS,
    {
      id: WalletId.LUTE,
      options: { siteName: '<YOUR_SITE_NAME>' }
    },
    WalletId.KIBISIS,
  ],
  network: NetworkId.TESTNET,
})

function App() {
  return (
    // Pass the manager to WalletProvider
    <WalletProvider manager={walletManager}>
      <MyApp />
    </WalletProvider>
  )
}
```

## Step 3: Update `useWallet` Hook Usage and Types

The `useWallet` hook has undergone several changes in v3.x. Here are the key differences and how to adapt your code:

1. **Rename `providers` to `wallets`**:
   * In v2.x: `providers` was an array of wallet providers.
   * In v3.x: This is now called `wallets`.
2. **Changes in returned properties**:
   * `connectedAccounts` is now `activeWalletAccounts`.
   * `signer` is now `transactionSigner`.
3. **Network management**:
   * New properties: `activeNetwork` and `setActiveNetwork` for managing the current network.
4. **Algod client**:
   * `algodClient` and `setAlgodClient` are now available directly from the hook.

The types exported by the library have changed as well. Some have changed to fit the new implementation, some have been renamed to be more descriptive and consistent, and others that were outside the scope of the library have been removed.

1. **Wallet accounts**:
   * In v2.x: `Account` was an object containing `providerId`, `name`, `address`, `authAddr`, and `email`.
   * In v3.x: This is now called `WalletAccount` and only contains a `name` and `address`.
2. **Wallet providers**:
   * `ProvidersArray` is now `SupportedWallets[]`.
   * `PROVIDER_ID` enum is renamed to `WalletId`.
   * `BaseClient` is now `BaseWallet`.
   * `Metadata` is now `WalletMetadata`.
3. **Types that have been removed**:
   * Algorand REST API response types such as `AccountInfo` and `Asset`.
   * Transaction types including `Txn`, `TxnType`, `TxnInfo`, `RawTxnResponse`, `ConfirmedTxn`, and `DecodedTransaction`.
   * Various other undocumented types that are no longer used with the v3.x implementation.

{% hint style="info" %}
**Note:** If you were using a type that was removed in v3.x, you can either redefine it in your application or see if an equivalent type exists in the `algosdk` or `@algorandfoundation/algokit-utils` NPM packages.

• v2.x `types` directory: [https://github.com/TxnLab/use-wallet/tree/v2/src/types](https://github.com/TxnLab/use-wallet/tree/v2/src/types)

• Algorand JS SDK: [https://github.com/algorand/js-algorand-sdk](https://github.com/algorand/js-algorand-sdk)

• Algokit TypeScript Utilities: [https://github.com/algorandfoundation/algokit-utils-ts](https://github.com/algorandfoundation/algokit-utils-ts)
{% endhint %}

## Step 4: Signing and Sending Transactions

Version 3.x introduces improvements in how transactions are signed and sent to the network, aligning more closely with recommended Algorand practices.

### Key Changes

1. **Flexible Transaction Formats**:
   * v3.x now accepts both `Uint8Array` encoded transactions and `algosdk.Transaction` objects.
   * This flexibility simplifies most common use cases.
2. **Improved Atomic Transaction Composer (ATC) Support**:
   * While possible in v2.x, ATC usage is now better supported and documented.
   * The implementation is more efficient, avoiding unnecessary transaction encoding.
3. **Streamlined API**:
   * Removed several utility functions that were essentially wrappers around `algosdk` methods.
   * Developers are now encouraged to use `algosdk` methods directly for manual transaction handling.
4. **ARC-0001 compliance:**
   * The optional `returnGroup` argument has been removed from `signTransactions`, conforming with ARC-0001's `SignTxnsFunction` type signature. This also simplifies the method's implementation.
   * Now `signTransactions` will always return `Promise<(Uint8Array | null)[]>`, a promise that resolves to an array of signed transactions or `null` for transactions that were not signed.

### Examples

#### **Signing and Sending Transactions using Atomic Transaction Composer**

This example demonstrates the recommended method using an Atomic Transaction Composer, which is now well-supported and efficient.

```typescript
import algosdk from 'algosdk'
import { useWallet } from '@txnlab/use-wallet-react'

function AtcTransactionExample() {
  const { activeAddress, transactionSigner, algodClient } = useWallet()

  const sendTransaction = async () => {
    if (!activeAddress) return

    const atc = new algosdk.AtomicTransactionComposer()
    
    // Add your transaction(s) to the composer
    atc.addTransaction({
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: 'RECIPIENT_ADDRESS',
        amount: 1000000,
        suggestedParams: await algodClient.getTransactionParams().do()
      }),
      signer: transactionSigner
    })

    // Execute the transaction(s)
    const result = await atc.execute(algodClient, 4)
    console.log('Transaction sent:', result.txIDs)
    console.log('Transaction confirmed in round:', result.confirmedRound)
  }

  return <button onClick={sendTransaction}>Send Transaction</button>
}
```

#### **Manually Signing and Sending Transactions**

The next example illustrates how to manually handle transactions if needed, though this is generally less common in typical use cases.

```typescript
import algosdk from 'algosdk'
import { useWallet } from '@txnlab/use-wallet-react'

function ManualTransactionExample() {
  const { activeAddress, signTransactions, algodClient } = useWallet()

  const sendTransaction = async () => {
    if (!activeAddress) return

    // Create the transaction(s)
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: 'RECIPIENT_ADDRESS',
      amount: 1000000,
      suggestedParams: await algodClient.getTransactionParams().do()
    })

    // Sign the transaction(s)
    const signedTxns = await signTransactions([txn])

    // Send the transaction(s)
    const { txId } = await algodClient.sendRawTransaction(signedTxns).do()
    console.log('Transaction sent:', txId)

    // Wait for confirmation
    const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4)
    console.log('Transaction confirmed in round:', confirmedTxn['confirmed-round'])
  }

  return <button onClick={sendTransaction}>Send Transaction</button>
}
```

{% hint style="info" %}
The `signTransactions` method will still accept an array of `Uint8Array` encoded transactions, as was required in v2.x (but is no longer necessary).
{% endhint %}

By adopting these patterns, developers can create more robust and efficient transaction handling in their applications while aligning with best practices in the Algorand ecosystem.

### Resources

{% embed url="https://developer.algorand.org/docs/get-details/atc/" %}
Atomic Transaction Composer documentation
{% endembed %}

{% embed url="https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0001.md" %}
ARC-0001 specification
{% endembed %}

## Technical Support

If you encounter any issues during the migration process or have questions about implementing new features:

1. **Discord Support**: Join our NFDomains Discord server, where we have a dedicated #use-wallet channel. Our team and community members are available to provide technical support and answer your questions.
   * Discord Invite Link: [Join NFDomains Discord](https://discord.gg/7XcuMTfeZP)
   * Channel: #use-wallet
2. **GitHub Issues**: For potential bugs or feature requests, please open an issue on our GitHub repository.
   * [https://github.com/TxnLab/use-wallet/issues](https://github.com/TxnLab/use-wallet/issues)

We're here to ensure your transition to v3.x is as smooth as possible. Don't hesitate to reach out – whether you're stuck on a particular migration step, need clarification on new features, or want to discuss best practices for your specific use case.
