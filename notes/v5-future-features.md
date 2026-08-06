# V5 Post-Stable Features

Features planned for v5.1+ after the core migration is complete. Informed by the [tasosbit/use-wallet](https://github.com/tasosbit/use-wallet) community fork (Liquid Accounts / EVM wallet integration) and the [use-wallet-ui plugin architecture PoC](https://github.com/TxnLab/use-wallet-ui).

These features are separated from the migration plan because they require independent design work and should not delay v5.0 stable.

---

## 1. Signing Middleware (`beforeSign` interception)

**Problem**: The tasosbit fork added `registerUIHook` to WalletManager and `managerUIHooks` to BaseWallet to enable a pre-sign confirmation dialog. The `onBeforeSign` hook is async and blocking — it pauses signing until the user approves via UI. This cannot be achieved with fire-and-forget events alone.

**What the fork does**:

```typescript
// Fork's approach — hooks registered on WalletManager, passed through to BaseWallet
manager.registerUIHook('onBeforeSign', async (txnGroup, indexesToSign) => {
  await showConfirmationDialog(txnGroup) // blocks until user approves
})

// Inside LiquidEvmBaseWallet.signTransactions():
const onBeforeSign = this.options.uiHooks?.onBeforeSign ?? this.managerUIHooks?.onBeforeSign
if (onBeforeSign) {
  await onBeforeSign(txnsAsUint8, indexesToSign)
}
```

**Proposed v5.1 design**: Separate middleware (async interception) from events (async observation):

```typescript
// Middleware — async, can pause or cancel signing
const unregister = manager.use('beforeSign', async ({ walletId, txnGroup, indexesToSign }) => {
  const approved = await showConfirmationDialog(txnGroup)
  if (!approved) throw new Error('User rejected')
})

// Events (from v5.0) — fire-and-forget observation
manager.on('beforeSign', ({ walletId, txnGroup }) => {
  analytics.track('sign_attempt', { walletId })
})
```

**Design questions to resolve**:
- How does middleware compose? (FIFO chain? All run in parallel?)
- Can middleware modify the transaction group, or only approve/reject?
- How are middleware errors surfaced to the consumer?
- Should `afterSign` middleware also be supported (e.g., for post-sign UI like the fork's `ExtensionSignIndicator`)?

**Relationship to v5.0**: The v5.0 event emitter defines `beforeSign` and `afterSign` as observation-only events. The middleware system adds the interception layer on top without changing the event API.

---

## 2. Raw Adapter Access from `Wallet` Interface

**Problem**: The tasosbit fork adds `getEvmProvider()` to the `Wallet` interface and uses duck-typing (`'getEvmProvider' in wallet`) in the React adapter. This is wallet-specific API leaking into the generic interface.

**What the fork does**:

```typescript
// React adapter — duck-types to conditionally expose EVM provider
const hasEvmProvider = 'getEvmProvider' in wallet && typeof (wallet as any).getEvmProvider === 'function'
return {
  ...baseWalletProps,
  ...(hasEvmProvider && { getEvmProvider: () => (wallet as any).getEvmProvider() })
}
```

**Proposed v5.1 design options**:

**Option A: Expose the adapter instance directly**
```typescript
export interface Wallet {
  // ... existing fields
  /** The underlying adapter instance. Use for wallet-specific methods. */
  adapter: BaseWallet
}

// Consumer usage
const pera = wallets.find(w => w.id === 'pera')
if (pera) {
  const peraAdapter = pera.adapter as PeraAdapter
  // access Pera-specific methods
}
```

**Option B: Generic `Wallet<T>` with adapter type**
```typescript
// More type-safe but more complex for framework adapters
const wallet: Wallet<PeraAdapter> = ...
wallet.adapter.peraSpecificMethod()
```

**Option C: `getAdapter()` method**
```typescript
export interface Wallet {
  getAdapter<T extends BaseWallet>(): T
}
```

Option A is simplest and matches how the Solid adapter already works (it returns raw `BaseWallet` instances). The tradeoff is exposing internal API to consumers, but with adapters moving to separate packages this is less risky — the adapter class is already public API.

---

## 3. `useWalletManager()` Hook

**Problem**: The fork adds a `useWalletManager()` hook to the React adapter that returns the raw `WalletManager` instance. This is useful for registering middleware, accessing the event emitter, or performing operations the `useWallet()` abstraction doesn't cover.

**What the fork does**:

```typescript
export const useWalletManager = (): WalletManager => {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletManager must be used within the WalletProvider')
  }
  return context.manager
}
```

**Proposed v5.1 design**: Add `useWalletManager()` to all four framework adapters. Trivial implementation (3-5 lines each), but it's new public API surface that should be documented and tested.

Use cases:
- `manager.on(...)` — subscribe to events
- `manager.use(...)` — register middleware (once that exists)
- `manager.setActiveNetwork(...)` — already accessible via `useNetwork()`, but some consumers prefer the imperative API
- Direct access for edge cases the hooks don't cover

---

## 4. `WalletMetadata` Extensibility

**Problem**: The fork adds `isLiquid?: 'EVM'` directly to the `WalletMetadata` type. This is too specific — it hardcodes a single community project's concept into the core type.

**What the fork does**:

```typescript
export type WalletMetadata = {
  name: string
  icon: string
  isLiquid?: 'EVM'  // <-- too specific
}

export type LiquidEvmMetadata = WalletMetadata & {
  isLiquid: 'EVM'
}
```

**Proposed v5.1 design options**:

**Option A: Generic `extra` field**
```typescript
export type WalletMetadata = {
  name: string
  icon: string
  extra?: Record<string, unknown>
}
```

**Option B: Index signature**
```typescript
export type WalletMetadata = {
  name: string
  icon: string
  [key: string]: unknown
}
```

**Option C: Leave as-is, use adapter-level typing**

Adapters that need custom metadata can define their own extended type and cast internally. Consumers who need to check for specific metadata can use the `WalletAccount.metadata` field (added in v5.0) or access the adapter directly (feature #2 above).

Option C is simplest and avoids adding loosely-typed fields to a core interface. The `WalletAccount.metadata` field (already planned for v5.0) handles the per-account case. Wallet-level metadata can wait for a concrete use case beyond the Liquid Accounts fork.

---

## 5. Liquid Accounts / EVM Wallet Adapter

**Context**: The tasosbit fork adds a `LiquidEvmBaseWallet` abstract class (extending `BaseWallet`) and a `RainbowKitWallet` concrete adapter. These enable Algorand dApps to accept EVM wallets (MetaMask, Rainbow, etc.) via the [Liquid Accounts](https://github.com/tasosbit/liquid-accounts) system, which derives Algorand addresses from EVM addresses.

**v5 architecture fit**: The v5 adapter extraction pattern supports this perfectly:
- `LiquidEvmBaseWallet` would be a separate package (e.g., `@txnlab/use-wallet-liquid-evm-base`) providing the abstract class
- `RainbowKitWallet` would be another package (e.g., `@liquid/use-wallet-rainbowkit`) extending it
- The factory function pattern works as-is: `rainbowkit({ wagmiConfig })`

**Dependencies on v5.0 features**:
- `WalletAccount.metadata` (#8 in plan review) — needed to persist EVM address mappings
- `updateMetadata()` (#9 in plan review) — needed to update wallet name/icon after connect
- Event emitter (#7 in plan review) — `beforeSign`/`afterSign` events replace the fork's `UIHooks`

**Dependencies on v5.1 features**:
- Signing middleware (#1 above) — needed for the pre-sign confirmation dialog
- Raw adapter access (#2 above) — needed for `getEvmProvider()` on the `Wallet` interface

**Timeline**: Can begin after v5.0 stable ships. The v5.0 foundation (extensible types, events) provides everything needed except the signing middleware.
