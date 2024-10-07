---
description: Public methods and properties of the WalletManager class
---

# 🗃️ WalletManager API

{% hint style="info" %}
The framework adapters abstract the `WalletManager` class and expose a similar API via the `useWallet` function/hook.
{% endhint %}

The following API is exposed via the `WalletManager` class instance:&#x20;

```typescript
class WalletManager {
  constructor({
    wallets: Array<T | WalletIdConfig<T>>,
    network?: NetworkId,
    algod?: NetworkConfig
  }: WalletManagerConstructor)
}
```

***

## Public Methods

### subscribe

```typescript
subscribe(callback: (state: State) => void): (() => void)
```

Subscribes to state changes.

* `callback`: The function to be executed when state changes.

### setActiveNetwork

```typescript
setActiveNetwork(network: NetworkId): void
```

Sets the active network (BetaNet, TestNet, MainNet, or LocalNet).

* `network`: The network to be set as active.

### getWallet

```typescript
getWallet(walletId: WalletId): BaseWallet | undefined
```

Returns a wallet provider client by its `WalletId`.

* `walletId`: The ID of the wallet to be retrieved.

### resumeSessions

```typescript
resumeSessions(): Promise<void>
```

Re-initializes the connected wallet(s) from persisted storage when the app mounts. Framework adapters handle this automatically.

***

## Public Properties

### wallets

```typescript
wallets: BaseWallet[]
```

An array of all initialized wallet provider clients.

### activeNetwork

```typescript
activeNetwork: NetworkId
```

The currently active network.

### algodClient

```typescript
algodClient: algosdk.Algodv2
```

The `Algodv2` client for the active network.

### activeWallet

```typescript
activeWallet: BaseWallet | null
```

The currently active wallet provider client instance.

### activeWalletAccounts

```typescript
activeWalletAccounts: WalletAccount[] | null
```

An array of connected accounts for the currently active wallet provider.

### activeWalletAddresses

```typescript
activeWalletAddresses: string[] | null
```

An array of addresses of the currently active wallet provider's accounts.

### activeAccount

```typescript
activeAccount: WalletAccount | null
```

The currently active account, the default `sender` used to sign transactions

### activeAddress

```typescript
activeAddress: string | null
```

The address of the currently active account.

### signTransactions

```typescript
signTransactions: BaseWallet['signTransactions']
```

A getter that returns the `signTransactions` method of the currently active wallet provider. It is a function that signs transactions of an atomic transaction group.

[Learn more...](basewallet-api.md#signtransactions)

### transactionSigner

```typescript
transactionSigner: BaseWallet['transactionSigner']
```

A getter that returns the `transactionSigner` method of the currently active wallet provider. It is a typed `TransactionSigner` function that signs transactions of an atomic transaction group.

[Learn more...](basewallet-api.md#transactionsigner)
