---
description: Public methods and properties of the BaseWallet abstract class
---

# 📂 BaseWallet API

The `BaseWallet` class is an abstract class that defines the interface for wallet implementations. Wallet providers all extend this class and implement its required methods.

```typescript
abstract class BaseWallet {
  constructor({
    id,
    metadata,
    store,
    subscribe,
    getAlgodClient
  }: WalletConstructor<WalletId>)
}
```

***

## Public Methods

### connect

```typescript
connect(): Promise<WalletAccount[]>
```

Connects the wallet to the dApp.

### disconnect

```typescript
disconnect(): Promise<void>
```

Disconnects the wallet from the dApp.

### resumeSession

```typescript
resumeSession(): Promise<void>
```

Re-initializes the connected wallet from persisted storage when the application mounts.

### setActive

```typescript
setActive(): void
```

Sets the wallet as the active wallet.

### setActiveAccount

```typescript
setActiveAccount(account: string): void
```

Sets the active account.

* `account`: The account address to be set as active.

### signTransactions

```typescript
signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
  txnGroup: T | T[],
  indexesToSign?: number[]
): Promise<(Uint8Array | null)[]>
```

Signs transactions of an atomic transaction group with this wallet provider. Transactions can be signed by any connected account in the wallet.

* `txnGroup`: An atomic transaction group of either `algosdk.Transaction` objects or their serialized bytes, or an array of atomic transaction groups.
* `indexesToSign`: An optional array of indexes in the atomic transaction group that should be signed.

### transactionSigner

```typescript
transactionSigner(
  txnGroup: algosdk.Transaction[],
  indexesToSign: number[]
): Promise<Uint8Array[]>
```

A typed [`TransactionSigner`](https://github.com/algorand/js-algorand-sdk/blob/v2.8.0/src/signer.ts#L7-L18) function that signs transactions of an atomic transaction group with this wallet provider. It can be used with `AtomicTransactionComposer` - see [https://developer.algorand.org/docs/get-details/atc/](https://developer.algorand.org/docs/get-details/atc/)

* `txnGroup`: An atomic transaction group of `algosdk.Transaction` objects.
* `indexesToSign`: An array of indexes in the atomic transaction group that should be signed.

### subscribe

```typescript
subscribe(callback: (state: State) => void): (() => void)
```

Subscribes to state changes.

* `callback`: The function to be executed when state changes.

***

## Public Properties

### id

```typescript
id: WalletId
```

The wallet's ID.

### metadata

```typescript
metadata: WalletMetadata
```

The wallet's metadata. An object containing the wallet's display `name` and `icon` expressed as a base64 data URI.

### name

```typescript
name: string
```

The wallet's name (in uppercase).

### accounts

```typescript
accounts: WalletAccount[]
```

The wallet's connected accounts.

### addresses

```typescript
addresses: string[]
```

The wallet's connected account addresses.

### activeAccount

```typescript
activeAccount: WalletAccount | null
```

The currently active account.

### activeAddress

```typescript
activeAddress: string | null
```

The currently active account's address.

### activeNetwork

```typescript
activeNetwork: NetworkId
```

The currently active network.

### isConnected

```typescript
isConnected: boolean
```

Whether the wallet provider is connected.

### isActive

```typescript
isActive: boolean
```

Whether the wallet provider is active.
