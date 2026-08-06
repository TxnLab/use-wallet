# use-wallet v5 Migration Plan

## 1. Overview

v5 extracts each wallet implementation into its own npm package, turning the core into a thin orchestration layer. This solves four problems with v4:

1. **Package bloat** — core bundles 14 wallet implementations even if a dApp uses 1-2.
2. **Gatekeeper bottleneck** — adding a wallet requires a PR to this repo.
3. **Webpack/Next.js build errors** — dynamic `import()` of optional peer deps causes bundler resolution failures, requiring a `webpackFallback` workaround.
4. **No tree-shaking** — unused wallets can't be eliminated.

### Terminology

v5 adopts **"adapter"** for wallet packages. In v4, wallet classes are called "providers" — in v5, they are **wallet adapters** (they adapt wallet SDKs to a common interface). Framework packages remain **framework adapters**.

---

## 2. Package Structure

### Directory Layout

```
v4                                  v5
packages/use-wallet/             →  packages/core/                  # @txnlab/use-wallet
packages/use-wallet-react/       →  packages/frameworks/react/      # @txnlab/use-wallet-react
packages/use-wallet-vue/         →  packages/frameworks/vue/        # @txnlab/use-wallet-vue
packages/use-wallet-solid/       →  packages/frameworks/solid/      # @txnlab/use-wallet-solid
packages/use-wallet-svelte/      →  packages/frameworks/svelte/     # @txnlab/use-wallet-svelte
(new)                               packages/wallets/pera/          # @txnlab/use-wallet-pera
(new)                               packages/wallets/defly/         # @txnlab/use-wallet-defly
(new)                               packages/wallets/defly-web/     # @txnlab/use-wallet-defly-web
(new)                               packages/wallets/exodus/        # @txnlab/use-wallet-exodus
(new)                               packages/wallets/walletconnect/ # @txnlab/use-wallet-walletconnect
(new)                               packages/wallets/web3auth/      # @txnlab/use-wallet-web3auth
(new)                               packages/wallets/mnemonic/      # @txnlab/use-wallet-mnemonic
(new)                               packages/wallets/kmd/           # @txnlab/use-wallet-kmd
(new)                               packages/wallets/magic/         # @txnlab/use-wallet-magic
(new)                               packages/wallets/lute/          # @txnlab/use-wallet-lute
(new)                               packages/wallets/kibisis/       # @txnlab/use-wallet-kibisis
(new)                               packages/wallets/biatec/        # @txnlab/use-wallet-biatec
(new)                               packages/wallets/w3wallet/      # @txnlab/use-wallet-w3wallet
(new)                               packages/wallets/custom/        # @txnlab/use-wallet-custom
```

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - examples/*
  - packages/**
```

Using `packages/**` discovers packages at any depth, supporting the nested structure.

### Dependency Graph

```
@txnlab/use-wallet-react ──────dep──────► @txnlab/use-wallet (core)
                               ▲                    ▲
                               │                    │ peerDep
@txnlab/use-wallet-pera ──peerDep───────────────────┘
                               │
                               ├──dep──► @perawallet/connect
                               └─peerDep──► algosdk
```

- **Framework adapters** depend on core as a regular dependency and re-export everything (unchanged from v4).
- **Wallet adapters** depend on core as a peer dependency. The consumer's framework adapter (or direct core install) satisfies it.
- **Wallet SDKs** are regular dependencies of their respective wallet adapter packages — consumers don't need to install them separately.
- **algosdk** is a peer dependency of core and wallet adapters (consumers use it directly).

### Consumer Installation

```bash
# React project
npm install @txnlab/use-wallet-react @txnlab/use-wallet-pera @txnlab/use-wallet-defly algosdk

# Vanilla TypeScript
npm install @txnlab/use-wallet @txnlab/use-wallet-pera algosdk
```

Framework adapters bring in core automatically. Wallet adapters bring in their SDK automatically. Consumers install only the adapters they need plus `algosdk`.

---

## 3. Configuration API

### v4 (before)

```typescript
import { WalletManager, WalletId } from '@txnlab/use-wallet'

const manager = new WalletManager({
  wallets: [
    WalletId.PERA,
    { id: WalletId.DEFLY, options: { shouldShowSignTxnToast: false } },
    { id: WalletId.WALLETCONNECT, options: { projectId: '...' } },
  ],
  defaultNetwork: 'testnet',
})
```

### v5 (after)

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

const manager = new WalletManager({
  wallets: [
    pera(),
    defly({ shouldShowSignTxnToast: false }),
    walletConnect({ projectId: '...' }),
  ],
  defaultNetwork: 'testnet',
})
```

Each wallet adapter package exports a **factory function** that returns a `WalletAdapterConfig`. This pattern:

- Gives **type-safe options** per wallet (IDE autocomplete works)
- Eliminates the need for a central `WalletId` enum in core
- Eliminates `createWalletMap()` — no static registry of all wallets
- Makes **tree-shaking automatic** — only imported adapters are bundled
- Eliminates **webpack fallback issues** — no dynamic `import()` of uninstalled packages
- Follows established patterns (wagmi connectors, etc.)

---

## 4. Core Package Changes (`@txnlab/use-wallet`)

### 4.1 New: `WalletAdapterConfig` and `AdapterConstructorParams`

The factory function return type, defined in core so both core and adapters share it:

```typescript
export interface WalletAdapterConfig {
  /** Unique identifier for this wallet adapter */
  id: string
  /** Display metadata (name, icon) */
  metadata: WalletMetadata
  /** The adapter class constructor */
  Adapter: new (params: AdapterConstructorParams) => BaseWallet
  /** Wallet-specific options, passed through to the adapter constructor */
  options?: Record<string, unknown>
}
```

`WalletAdapterConfig` uses `Record<string, unknown>` for options (type erasure) because the manager handles heterogeneous adapter configs in a single array. Type safety lives in the factory function signature, not the config object.

`AdapterConstructorParams` is generic so adapters receive typed options without unsafe casts:

```typescript
export interface AdapterConstructorParams<TOptions = Record<string, unknown>> {
  id: string
  metadata: WalletMetadata
  store: AdapterStoreAccessor
  subscribe: (callback: (state: State) => void) => () => void
  getAlgodClient: () => algosdk.Algodv2
  options?: TOptions
}
```

### 4.1.1 Scoped Store Access (`AdapterStoreAccessor`)

Instead of passing the raw `Store<State>` to adapters (which lets any adapter mutate any other wallet's state), v5 passes a scoped interface:

```typescript
export interface AdapterStoreAccessor {
  getWalletState(): WalletState | undefined
  getActiveWallet(): WalletKey | null
  getActiveNetwork(): string
  getState(): State
  addWallet(wallet: WalletState): void
  removeWallet(): void
  setAccounts(accounts: WalletAccount[]): void
  setActive(): void
}
```

`WalletManager` creates a scoped accessor per adapter during initialization, binding the wallet's key:

```typescript
private createStoreAccessor(walletKey: string): AdapterStoreAccessor {
  return {
    getWalletState: () => this.store.state.wallets[walletKey],
    getActiveWallet: () => this.store.state.activeWallet,
    getActiveNetwork: () => this.store.state.activeNetwork,
    getState: () => this.store.state,
    addWallet: (wallet) => addWallet(this.store, { walletId: walletKey, wallet }),
    removeWallet: () => removeWallet(this.store, { walletId: walletKey }),
    setAccounts: (accounts) => setAccounts(this.store, { walletId: walletKey, accounts }),
    setActive: () => setActiveWallet(this.store, { walletId: walletKey }),
  }
}
```

Benefits: simpler adapter API, prevents cross-wallet state corruption, easier to mock in tests. Adapters call `this.store.addWallet(walletState)` instead of `addWallet(this.store, { walletId: this.id, wallet: walletState })`.

### 4.2 WalletManager Changes

**Config type change:**

```typescript
// v4
export interface WalletManagerConfig {
  wallets?: SupportedWallet[]           // WalletId | WalletIdConfig
  networks?: Record<string, NetworkConfig>
  defaultNetwork?: string
  options?: WalletManagerOptions
}

// v5
export interface WalletManagerConfig {
  wallets?: WalletAdapterConfig[]       // Factory function results
  networks?: Record<string, NetworkConfig>
  defaultNetwork?: string
  options?: WalletManagerOptions
}
```

**`initializeWallets()` rewrite:**

```typescript
private initializeWallets(walletConfigs: WalletAdapterConfig[]) {
  for (const config of walletConfigs) {
    const walletKey = config.id

    if (this._clients.has(walletKey)) {
      this.logger.warn(`Duplicate wallet key: ${walletKey}. Skipping...`)
      continue
    }

    const storeAccessor = this.createStoreAccessor(walletKey)

    const instance = new config.Adapter({
      id: config.id,
      metadata: config.metadata,
      store: storeAccessor,
      subscribe: this.subscribe,
      getAlgodClient: this.getAlgodClient,
      options: config.options,
    })

    this._clients.set(walletKey, instance)
  }

  // ... existing cleanup of stale persisted state
}
```

**Event emitter:**

Add a lightweight event system to WalletManager. Define the full event surface from v5.0 so the API is stable even if most events go unused initially:

```typescript
type WalletManagerEvents = {
  ready: void
  walletConnected: { walletId: string; accounts: WalletAccount[] }
  walletDisconnected: { walletId: string }
  activeWalletChanged: { walletId: string | null }
  activeAccountChanged: { walletId: string; address: string }
  networkChanged: { networkId: string }
  beforeSign: {
    walletId: string
    txnGroup: algosdk.Transaction[] | Uint8Array[]
    indexesToSign?: number[]
  }
  afterSign: { walletId: string; success: boolean; error?: Error }
  error: { walletId?: string; error: Error }
}

manager.on('walletConnected', handler)  // returns unsubscribe function
```

The `beforeSign`/`afterSign` events are **observation-only** (fire-and-forget). Async interception (pause/cancel signing) is a separate middleware feature planned for v5.1+ — see `docs/v5-future-features.md`. The event surface is designed to support that future addition without breaking changes.

### 4.3 Remove from Core

| File | Action |
|------|--------|
| `src/wallets/pera.ts` | Remove (extracted to `@txnlab/use-wallet-pera`) |
| `src/wallets/defly.ts` | Remove (extracted) |
| `src/wallets/defly-web.ts` | Remove (extracted) |
| `src/wallets/exodus.ts` | Remove (extracted) |
| `src/wallets/walletconnect.ts` | Remove (extracted) |
| `src/wallets/web3auth.ts` | Remove (extracted) |
| `src/wallets/mnemonic.ts` | Remove (extracted) |
| `src/wallets/kmd.ts` | Remove (extracted) |
| `src/wallets/magic.ts` | Remove (extracted) |
| `src/wallets/lute.ts` | Remove (extracted) |
| `src/wallets/kibisis.ts` | Remove (extracted) |
| `src/wallets/biatec.ts` | Remove (extracted) |
| `src/wallets/w3wallet.ts` | Remove (extracted) |
| `src/wallets/avm-web-provider.ts` | Remove (moved to w3wallet adapter) |
| `src/wallets/custom.ts` | Remove (extracted) |
| `src/wallets/skins.ts` | Remove (moved to walletconnect adapter) |
| `src/webpack.ts` | Remove entirely |
| `src/utils.ts` → `createWalletMap()` | Remove function |
| `src/utils.ts` → `deepMerge()` | Remove (already marked `@todo: remove`) |
| `src/store.ts` → `isValidWalletId()` | Remove (depends on `WalletId` enum being removed) |
| `src/store.ts` → `isValidWalletKey()` | Remove (depends on `WalletId` enum being removed) |

### 4.4 Keep in Core

| File | Notes |
|------|-------|
| `src/wallets/base.ts` | `BaseWallet` abstract class — the adapter contract |
| `src/wallets/types.ts` | Shared types (`WalletAccount`, `SignerTransaction`, etc.) |
| `src/manager.ts` | `WalletManager` — updated config API |
| `src/store.ts` | State management — unchanged shape |
| `src/network.ts` | Network config — unchanged |
| `src/storage.ts` | `StorageAdapter` — unchanged |
| `src/secure-key.ts` | `SecureKeyContainer` — unchanged |
| `src/logger.ts` | Scoped logger — unchanged |
| `src/utils.ts` | Utility functions (minus `createWalletMap`) |

### 4.5 Subpath Export for Adapter Authors

Wallet adapters need access to utilities and types that are currently internal. Use a dedicated subpath export to keep the consumer API surface clean:

```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
    "./adapter": { "import": "./dist/adapter.js", "require": "./dist/adapter.cjs", "types": "./dist/adapter.d.ts" }
  }
}
```

**`@txnlab/use-wallet/adapter`** exports everything an adapter author needs:

- `BaseWallet` abstract class
- `AdapterConstructorParams<TOptions>` interface
- `AdapterStoreAccessor` interface
- `WalletAdapterConfig` interface
- Shared types: `WalletAccount`, `WalletMetadata`, `WalletState`, `WalletKey`, `SignerTransaction`, `WalletTransaction`, `MultisigMetadata`, `StdSignData`, `StdSignDataResponse`, `StdSignMetadata`, `ScopeType`, `SignTxnsError`, `SignDataError`, `JsonRpcRequest`, `Siwa`
- Utility functions: `compareAccounts`, `isSignedTxn`, `isTransaction`, `isTransactionArray`, `flattenTxnGroup`, `base64ToByteArray`, `byteArrayToBase64`, `stringToByteArray`, `byteArrayToString`, `formatJsonRpcRequest`
- `SecureKeyContainer`, `withSecureKey`, `withSecureKeySync`, `zeroMemory`, `zeroString`
- `State` type (for subscribe callback typing)
- `LogLevel` and logger utilities

The main `@txnlab/use-wallet` entry point exports what consumers need: `WalletManager`, `WalletManagerConfig`, `NetworkId`, `NetworkConfig`, `Wallet`, `WalletAccount`, etc. The adapter subpath is the documented entry point for external wallet teams building their own adapters.

**`@txnlab/use-wallet/testing`** exports test helpers to reduce boilerplate across adapter test suites:

```typescript
export function createTestStore(overrides?: Partial<State>): Store<State>
export function createMockAlgodClient(): algosdk.Algodv2
export function createMockStoreAccessor(
  walletKey: string,
  overrides?: Partial<AdapterStoreAccessor>
): AdapterStoreAccessor
```

This is especially valuable for external adapter maintainers — they import standard test helpers rather than copying boilerplate from this repo.

### 4.6 `WalletId` Type Change

```typescript
// v4 — enum (closed set)
export enum WalletId {
  PERA = 'pera',
  DEFLY = 'defly',
  // ... 14 total
}

// v5 — string type (open set)
export type WalletId = string
```

Since enum values were already strings at runtime (`WalletId.PERA === 'pera'`), this is backward-compatible for runtime code. Code that pattern-matches on enum members (`WalletId.PERA`) will need to use string literals (`'pera'`) or import the wallet ID constant from the adapter package.

Each wallet adapter exports its own ID constant:

```typescript
// @txnlab/use-wallet-pera
export const WALLET_ID = 'pera' as const
```

### 4.7 `WalletKey` Type Change

```typescript
// v4
export type WalletKey = WalletId | `${WalletId.WALLETCONNECT}:${string}`

// v5
export type WalletKey = string
```

Composite keys for WalletConnect skins (e.g., `walletconnect:biatec`) still work — they're just strings. The WalletConnect adapter handles composite key generation internally.

### 4.8 `Wallet` Interface — Move to Core

The `Wallet` interface (the public-facing shape returned by `useWallet()`) is currently defined separately in each framework adapter. In v5, define it once in core and export it:

```typescript
// packages/core/src/wallets/types.ts
export interface Wallet {
  id: string
  walletKey: string
  metadata: WalletMetadata
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
  isConnected: boolean
  isActive: boolean
  canSignData: boolean
  canUsePrivateKey: boolean
  connect: (args?: Record<string, any>) => Promise<WalletAccount[]>
  disconnect: () => Promise<void>
  setActive: () => void
  setActiveAccount: (address: string) => void
}
```

Framework adapters import and use this type instead of defining their own.

### 4.9 Remove Wallet-Specific Types from Core

The v4 `WalletMap`, `WalletOptionsMap`, `WalletConfigMap`, and `WalletIdConfig` types exist to provide type-safe mapping from `WalletId` to wallet class and options. These are no longer needed since each adapter defines its own options type. Remove them from `src/wallets/types.ts`.

Types to **remove**:
- `WalletMap`
- `WalletOptionsMap`
- `WalletConfigMap`
- `WalletOptions<T>`
- `WalletConfig<T>`
- `WalletIdConfig<T>`
- `SupportedWallet`
- `SupportedWallets`

Types to **keep** (shared contract):
- `WalletAccount` — add optional `metadata` field (see §4.11)
- `WalletMetadata`
- `WalletKey` (as `string`)
- `WalletConstructor` → renamed/simplified to `AdapterConstructorParams`
- `BaseWalletConstructor` → folded into `AdapterConstructorParams`
- `WalletTransaction`, `SignerTransaction`, `MultisigMetadata`
- `SignData` → renamed to `StdSignData`; the optional `signature?` field is dropped (`signature` exists only on the response type)
- `SignDataResponse` → renamed to `StdSignDataResponse`
- `SignMetadata` → renamed to `StdSignMetadata`
- `ScopeType`
- `SignTxnsError`, `SignDataError`
- `JsonRpcRequest`
- `Siwa` — `chain_id` changes from the hardcoded literal `'283'` to `string`, set to the active network's CAIP-2 chain identifier

### 4.10 State Persistence

**Storage key** changes from `@txnlab/use-wallet:v4` to `@txnlab/use-wallet:v5`.

The persisted state shape (`PersistedState`) is structurally identical — wallet IDs were already strings at runtime. However, using a new key provides a clean break and avoids edge cases with stale v4 state referencing wallet keys that no longer exist in the config.

Users will need to reconnect wallets once after upgrading. This is acceptable for a major version bump.

### 4.11 `WalletAccount.metadata` Field

Add an optional metadata field to `WalletAccount`:

```typescript
export type WalletAccount = {
  name: string
  address: string
  metadata?: Record<string, unknown>
}
```

One optional field, zero breakage. Enables adapters to persist wallet-specific account data (e.g., hardware wallet derivation paths, EVM address mappings for Liquid Accounts). This is a "while you're in there" change — the type is already being touched during migration.

---

## 5. Wallet Adapter Architecture

### 5.1 Package Template

Each wallet adapter follows this structure:

```
packages/wallets/{name}/
├── src/
│   ├── index.ts          # Public exports: factory fn, class, types, WALLET_ID
│   └── adapter.ts        # Adapter class extending BaseWallet
├── package.json
├── tsconfig.json          # Extends shared base config
├── tsup.config.ts         # Extends shared base config
└── README.md
```

### 5.1.1 Shared Build Configuration

14+ adapter packages would duplicate identical build config. Create shared base configs that adapters extend:

```
packages/wallets/
├── tsconfig.base.json       # Shared compiler options
├── tsup.config.base.ts      # Shared build settings
├── vitest.config.base.ts    # Shared test config
├── pera/
│   ├── tsconfig.json        # { "extends": "../tsconfig.base.json" }
│   ├── tsup.config.ts       # import base from '../tsup.config.base'
│   └── ...
├── defly/
│   └── ...
```

These are a transitional convenience for the monorepo phase. When wallet teams fork their adapters to their own repos, they copy/adapt the configs — the files are small enough (~10-20 lines) that this is trivial.

### 5.2 `package.json` Template

```json
{
  "name": "@txnlab/use-wallet-{name}",
  "version": "5.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "peerDependencies": {
    "@txnlab/use-wallet": "^5.0.0",
    "algosdk": "^3.0.0"
  },
  "devDependencies": {
    "@txnlab/use-wallet": "workspace:*",
    "algosdk": "3.6.0",
    "tsup": "8.5.1",
    "typescript": "5.9.3"
  },
  "scripts": {
    "build": "tsup",
    "start": "tsup src/index.ts --watch",
    "lint": "eslint -c \"../../../.eslintrc.json\" \"**/*.{js,ts}\"",
    "typecheck": "tsc --noEmit"
  }
}
```

Wallet adapters with external SDK dependencies add them as regular dependencies (so consumers don't have to install them separately):

```json
{
  "peerDependencies": {
    "@txnlab/use-wallet": "^5.0.0",
    "algosdk": "^3.0.0"
  },
  "dependencies": {
    "@perawallet/connect": "^1.4.1"
  }
}
```

### 5.3 Adapter Class Pattern

```typescript
// packages/wallets/pera/src/adapter.ts
import algosdk from 'algosdk'
import {
  BaseWallet,
  compareAccounts,
  flattenTxnGroup,
  isSignedTxn,
  isTransactionArray,
  type AdapterConstructorParams,
  type SignerTransaction,
  type WalletAccount,
  type WalletMetadata,
  type WalletState,
} from '@txnlab/use-wallet/adapter'
import type { PeraWalletConnect } from '@perawallet/connect'

export interface PeraOptions {
  bridge?: string
  shouldShowSignTxnToast?: boolean
  chainId?: 416001 | 416002 | 416003 | 4160
  compactMode?: boolean
}

const ICON = `data:image/svg+xml;base64,...`

export class PeraAdapter extends BaseWallet<PeraOptions> {
  private client: PeraWalletConnect | null = null

  constructor(params: AdapterConstructorParams<PeraOptions>) {
    super(params)
    // this.options is already typed as PeraOptions — no unsafe cast needed
  }

  static defaultMetadata: WalletMetadata = {
    name: 'Pera',
    icon: ICON,
  }

  public connect = async (): Promise<WalletAccount[]> => {
    const client = this.client || (await this.initializeClient())
    const accounts = await client.connect()
    // ...
    const walletState: WalletState = { accounts: walletAccounts, activeAccount }

    // Scoped store access — no need to pass walletId
    this.store.addWallet(walletState)
    return walletAccounts
  }

  // ... disconnect, resumeSession, signTransactions
  // Same implementation as v4, but imports from '@txnlab/use-wallet/adapter'
  // and uses scoped store methods instead of direct store mutations
}
```

### 5.4 Factory Function Pattern

```typescript
// packages/wallets/pera/src/index.ts
import { PeraAdapter } from './adapter'
import type { PeraOptions } from './adapter'
import type { WalletAdapterConfig } from '@txnlab/use-wallet'

export const WALLET_ID = 'pera' as const

export function pera(options?: PeraOptions): WalletAdapterConfig {
  return {
    id: WALLET_ID,
    metadata: PeraAdapter.defaultMetadata,
    Adapter: PeraAdapter,
    options,
  }
}

export { PeraAdapter }
export type { PeraOptions }
```

### 5.5 WalletConnect Skins

The WalletConnect adapter supports skins, which generate composite wallet keys. In v5, the skin mechanism moves entirely into the `@txnlab/use-wallet-walletconnect` package:

```typescript
// @txnlab/use-wallet-walletconnect
export function walletConnect(options: WalletConnectOptions): WalletAdapterConfig {
  const skin = options.skin ? resolveSkin(options.skin) : null
  const id = skin ? `walletconnect:${skin.id}` : 'walletconnect'
  const metadata = skin
    ? { name: skin.name, icon: skin.icon }
    : WalletConnectAdapter.defaultMetadata

  return { id, metadata, Adapter: WalletConnectAdapter, options }
}
```

The `skins.ts` definitions and `resolveSkin()` logic move to the walletconnect adapter package.

### 5.6 Biatec Adapter

Biatec is currently a WalletConnect-based wallet with its own implementation file. Two options for v5:

**Option A**: Standalone `@txnlab/use-wallet-biatec` package that extends BaseWallet directly (same as v4 but extracted).

**Option B**: Thin package that re-exports a pre-configured WalletConnect adapter:

```typescript
// @txnlab/use-wallet-biatec
import { walletConnect, type WalletConnectOptions } from '@txnlab/use-wallet-walletconnect'

export function biatec(options?: Omit<WalletConnectOptions, 'skin'>): WalletAdapterConfig {
  return walletConnect({ ...options, skin: 'biatec' })
}
```

Option A is simpler for the initial extraction and avoids a dependency between wallet adapter packages.

### 5.7 Built-in vs External SDK Wallets

Some wallets have no external SDK dependency (Exodus, Kibisis, Defly Web, KMD, Mnemonic). They still get their own packages for consistency, but their `package.json` has no wallet SDK peer deps:

```json
{
  "peerDependencies": {
    "@txnlab/use-wallet": "^5.0.0",
    "algosdk": "^3.0.0"
  }
}
```

### 5.8 Third-Party Adapter Guide

With v5, anyone can publish a wallet adapter without a PR to this repo. The requirements:

1. Install `@txnlab/use-wallet` and `algosdk` as peer deps
2. Create a class extending `BaseWallet`
3. Implement `connect()`, `disconnect()`, `resumeSession()`, `signTransactions()`
4. Export a factory function returning `WalletAdapterConfig`
5. Publish to npm

---

## 6. Framework Adapter Changes

### 6.1 Directory Moves

```
packages/use-wallet-react/    →  packages/frameworks/react/
packages/use-wallet-vue/      →  packages/frameworks/vue/
packages/use-wallet-solid/    →  packages/frameworks/solid/
packages/use-wallet-svelte/   →  packages/frameworks/svelte/
```

npm package names stay the same (`@txnlab/use-wallet-react`, etc.).

### 6.2 Dependency Changes

**Remove all wallet SDK peer dependencies.** Framework adapters no longer need them — wallet SDKs are peer deps of the individual wallet adapter packages.

```json
// v4 package.json — framework adapter
{
  "peerDependencies": {
    "react": "^17 || ^18 || ^19",
    "@perawallet/connect": "^1.4.1",    // REMOVE
    "@walletconnect/sign-client": "...", // REMOVE
    // ... all wallet SDKs                 REMOVE
  }
}

// v5 package.json — framework adapter
{
  "peerDependencies": {
    "react": "^17 || ^18 || ^19"
  },
  "dependencies": {
    "@txnlab/use-wallet": "workspace:*",
    "@tanstack/react-store": "0.8.0"
  }
}
```

### 6.3 Code Changes

Framework adapters need minimal code changes:

1. Import `Wallet` interface from core instead of defining it locally
2. Remove `WalletId` enum imports (use string types)
3. The `WalletProvider` / plugin / context setup is unchanged
4. The `useWallet()` and `useNetwork()` hooks are unchanged in return shape

### 6.4 Solid Adapter Alignment

The Solid adapter currently returns raw `BaseWallet` instances from `useWallet()` instead of a `Wallet` interface like the other adapters. v5 should align Solid with the others by returning transformed `Wallet` objects.

---

## 7. BaseWallet Changes

### 7.1 Generic `BaseWallet<TOptions>`

```typescript
// v4
export type WalletConstructor<T extends keyof WalletOptionsMap> = BaseWalletConstructor & {
  options?: WalletOptions<T>
  defaultMetadata?: WalletMetadata
}

// v5
export abstract class BaseWallet<TOptions = Record<string, unknown>> {
  public readonly id: string
  public readonly walletKey: string
  public metadata: WalletMetadata
  protected options: TOptions
  protected store: AdapterStoreAccessor

  protected constructor(params: AdapterConstructorParams<TOptions>) {
    this.id = params.id
    this.walletKey = params.id
    this.metadata = params.metadata
    this.options = params.options ?? ({} as TOptions)
    this.store = params.store
    // ...
  }
}
```

The generic parameter flows from `AdapterConstructorParams<TOptions>` through to `this.options`, so adapters never need unsafe casts:

```typescript
// Adapter — this.options is already PeraOptions
export class PeraAdapter extends BaseWallet<PeraOptions> {
  constructor(params: AdapterConstructorParams<PeraOptions>) {
    super(params)
  }
}
```

`WalletAdapterConfig` still uses `Record<string, unknown>` at the manager level (type erasure for heterogeneous arrays). Type safety lives in the factory function, not the config object.

### 7.2 Scoped Store Access

In v4, adapters access the raw `Store<State>` and call standalone mutation functions:

```typescript
// v4
addWallet(this.store, { walletId: this.id, wallet: walletState })
setAccounts(this.store, { walletId: this.id, accounts: walletAccounts })
```

In v5, `this.store` is an `AdapterStoreAccessor` (see §4.1.1) with scoped methods:

```typescript
// v5
this.store.addWallet(walletState)
this.store.setAccounts(walletAccounts)
this.store.removeWallet()
this.store.setActive()
```

Benefits: simpler adapter code, prevents cross-wallet state corruption, easier to mock in tests. The `onDisconnect()` protected method on BaseWallet updates to use `this.store.removeWallet()`.

### 7.3 Remove `manageWalletConnectSession` from BaseWallet

This protected method only exists to work around a WalletConnect localStorage key collision and is only used by Pera and Defly. It doesn't belong on the abstract base class. During extraction, each adapter carries its own copy of the ~20-line method. The hardcoded cross-references (`WalletId.DEFLY` in pera.ts, `WalletId.PERA` in defly.ts) become string literals (`'defly'`, `'pera'`) since `WalletId` is a string type in v5.

### 7.4 Add `updateMetadata()` Protected Method

```typescript
protected updateMetadata(updates: Partial<WalletMetadata>): void {
  this.metadata = { ...this.metadata, ...updates }
}
```

Some adapters don't know their display name/icon until after `connect()` (e.g., a future RainbowKit adapter discovers whether the user picked MetaMask or Rainbow at connect time). Currently `metadata` is effectively readonly after construction. A protected setter lets adapters update it post-connect without a public API change.

### 7.5 Add `createStdSignData()` Protected Method

```typescript
protected createStdSignData = async (data: string): Promise<StdSignData>
```

`signData(data: string, metadata: StdSignMetadata)` accepts the payload as a plain string; constructing the ARC-60 `StdSignData` envelope is the adapter's responsibility, not the consuming app's. This helper builds it for the active account: it resolves the signer public key via algod (so rekeyed accounts sign with their auth address), sets `domain` to the current host, and derives `authenticatorData` from the SHA-256 hash of the domain. Adapters that support ARC-60 signing (currently Lute) call it and forward the result to the wallet.

### 7.6 Internal Import Paths

In v4, wallet implementations use path-aliased imports (`src/store`, `src/utils`). In v5, all adapter code imports from the published package:

```typescript
// v4 (internal)
import { addWallet } from 'src/store'
import { compareAccounts } from 'src/utils'

// v5 (external)
import { BaseWallet, compareAccounts } from '@txnlab/use-wallet/adapter'
```

---

## 8. Build & CI Changes

### 8.1 Build Scripts

Update root `package.json` build scripts to handle the nested structure:

```json
{
  "scripts": {
    "build:core": "pnpm --filter @txnlab/use-wallet build",
    "build:wallets": "pnpm -r --filter './packages/wallets/*' build",
    "build:frameworks": "pnpm -r --filter './packages/frameworks/*' build",
    "build:packages": "pnpm run build:core && pnpm run build:wallets && pnpm run build:frameworks",
    "build:examples": "pnpm -r --filter './examples/*' build",
    "build": "pnpm run build:packages && pnpm run build:examples"
  }
}
```

Build order matters: core first, then wallets and frameworks (they depend on core).

### 8.2 CI Workflow

Update `.github/workflows/ci.yml`:
- Change branch triggers to include `v5`
- Build order: core → wallets → frameworks → examples
- Lint/typecheck all packages
- Run tests for core and each wallet adapter

### 8.3 VS Code Workspace

Update `.vscode/settings.json` `eslint.workingDirectories` to include new package paths.

### 8.4 Renovate

Update `.github/renovate.json` grouping rules to handle wallet adapter packages.

### 8.5 Automated Releases with semantic-release

v4 has no automated release pipeline. v5 adds semantic-release for commit-driven, lockstep versioning across all packages.

**Versioning strategy**: All packages share one version number (lockstep) while they live in this monorepo. When wallet teams eventually fork their adapter to a separate repo, that package versions independently. Lockstep keeps the initial release simple and avoids cross-package version matrix issues.

#### 8.5.1 Dependencies

Install as root devDependencies:

```bash
pnpm add -Dw semantic-release @semantic-release/commit-analyzer \
  @semantic-release/release-notes-generator @semantic-release/changelog \
  @semantic-release/npm @semantic-release/github @semantic-release/git \
  @semantic-release/exec publint
```

#### 8.5.2 Root `.releaserc.js`

A single root config drives versioning. `@semantic-release/exec` handles multi-package version bumping and publishing since `@semantic-release/npm` only supports a single package:

```javascript
export default {
  tagFormat: 'v${version}',
  branches: [
    'main',
    { name: 'v5', prerelease: 'rc', channel: 'next' },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    ['@semantic-release/release-notes-generator', {
      preset: 'angular',
      presetConfig: {
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'refactor', section: 'Code Refactoring', hidden: false },
          { type: 'perf', section: 'Performance Improvements', hidden: false },
          { type: 'docs', hidden: true },
          { type: 'style', hidden: true },
          { type: 'chore', hidden: true },
          { type: 'test', hidden: true },
          { type: 'build', hidden: true },
          { type: 'ci', hidden: true },
        ],
      },
    }],
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    ['@semantic-release/exec', {
      prepareCmd: 'node scripts/update-versions.mjs ${nextRelease.version}',
      publishCmd: 'node scripts/publish-packages.mjs',
    }],
    ['@semantic-release/github'],
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md', '**/package.json', '!**/node_modules/**'],
      message: 'chore(release): ${nextRelease.version} [skip ci]',
    }],
  ],
}
```

#### 8.5.3 Multi-Package Scripts

**`scripts/update-versions.mjs`** — Updates version in all publishable `package.json` files:

```javascript
// Reads pnpm workspace packages, updates version field in each,
// also updates workspace:* references to the new version for publishing
```

**`scripts/publish-packages.mjs`** — Publishes packages in dependency order:

```javascript
// 1. Publish core (@txnlab/use-wallet)
// 2. Publish wallet adapters (depend on core)
// 3. Publish framework adapters (depend on core)
// Each: pnpm publish --no-git-checks --access public --provenance
```

Build order for publishing: core → wallet adapters → framework adapters. Each `pnpm publish` call uses `--provenance` for OIDC-based npm authentication (no npm token needed).

#### 8.5.4 Pre-release Support

The `branches` config enables pre-releases from the `v5` branch during development:

```
v5 branch → 5.0.0-rc.1, 5.0.0-rc.2, ... → npm tag: @next
main branch → 5.0.0, 5.0.1, 5.1.0, ... → npm tag: @latest
```

Consumers can test pre-releases:

```bash
npm install @txnlab/use-wallet@next @txnlab/use-wallet-pera@next
```

Once v5 is stable and merged to `main`, the `v5` pre-release branch config can be removed.

#### 8.5.5 Package Configuration

Every publishable `package.json` needs:

```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

Root `package.json` must have:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/TxnLab/use-wallet.git"
  }
}
```

#### 8.5.6 publint Validation

Add `publint` as a pre-release check across all packages:

```json
{
  "scripts": {
    "publint": "pnpm -r --filter './packages/**' exec publint"
  }
}
```

This catches packaging issues (missing exports, incorrect `main`/`module`/`types` paths) before publishing.

#### 8.5.7 Release Workflow (`.github/workflows/release.yml`)

Runs on push to `main` and `v5` branches. Separate from CI (which runs on PRs).

```yaml
name: Release
on:
  push:
    branches: [main, v5]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Generate release token
        id: generate_token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ vars.RELEASE_BOT_APP_ID }}
          private-key: ${{ secrets.RELEASE_BOT_PRIVATE_KEY }}

      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
          token: ${{ steps.generate_token.outputs.token }}

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: npm install -g npm@latest
      - run: npm audit signatures

      - run: pnpm run build:packages
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run publint

      - name: Release
        env:
          GITHUB_TOKEN: ${{ steps.generate_token.outputs.token }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          GIT_AUTHOR_NAME: TxnLab Release Bot[bot]
          GIT_AUTHOR_EMAIL: txnlab-release-bot[bot]@users.noreply.github.com
          GIT_COMMITTER_NAME: TxnLab Release Bot[bot]
          GIT_COMMITTER_EMAIL: txnlab-release-bot[bot]@users.noreply.github.com
        run: npx semantic-release
```

Uses TxnLab Release Bot GitHub App for authentication. OIDC trusted publishing handles npm (configure on npmjs.com after first manual publish of each package).

#### 8.5.8 CI Workflow Updates

The existing CI workflow (`ci.yml`) should:
- Trigger on PRs only (not push to `main`/`v5` — that's the release workflow's job)
- Add `publint` as a check step after build
- Add concurrency with `cancel-in-progress: true`

#### 8.5.9 `.prettierignore` Update

Add `CHANGELOG.md` — the generated changelog won't conform to Prettier formatting.

#### 8.5.10 npm Trusted Publishing Setup

For each new package (`@txnlab/use-wallet-pera`, etc.):

1. First publish must be manual: `pnpm publish --access public` from each package directory
2. On npmjs.com → package → Settings → Publishing access → Add trusted publisher:
   - Repository: `TxnLab/use-wallet`
   - Workflow: `release.yml`
   - Environment: (blank)
3. After setup, OIDC handles all subsequent publishes automatically

This is a one-time setup per package. Do it during Sprint 4 after all packages exist.

---

## 9. Example App Changes

Example apps update their configuration:

```typescript
// v4
import { WalletManager, WalletId } from '@txnlab/use-wallet-react'

const manager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY],
})

// v5
import { WalletManager } from '@txnlab/use-wallet-react'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [pera(), defly()],
})
```

The `useWallet()` hook usage and component code remain unchanged.

---

## 10. Sprint Breakdown

### Sprint 1: Core Foundation

Restructure core, define new adapter interfaces, remove wallet implementations.

1. Move `packages/use-wallet/` → `packages/core/`
2. Update `pnpm-workspace.yaml` to `packages/**`
3. Make `BaseWallet` generic: `BaseWallet<TOptions>`
4. Define `WalletAdapterConfig`, `AdapterConstructorParams<TOptions>`, and `AdapterStoreAccessor` interfaces
5. Implement `WalletManager.createStoreAccessor()` for scoped store access
6. Refactor `WalletManager` constructor and `initializeWallets()` to accept `WalletAdapterConfig[]`
7. Add event emitter to `WalletManager` (define full `WalletManagerEvents` surface)
8. Convert `WalletId` from enum to string type
9. Simplify `WalletKey` to `string`
10. Remove `WalletMap`, `WalletOptionsMap`, `WalletConfigMap` and related types
11. Remove `manageWalletConnectSession()` from `BaseWallet`
12. Add `updateMetadata()` protected method to `BaseWallet`
13. Add optional `metadata` field to `WalletAccount` type
14. Move `Wallet` interface definition to core
15. Set up subpath exports: `@txnlab/use-wallet/adapter` and `@txnlab/use-wallet/testing`
16. Create `@txnlab/use-wallet/testing` helpers (`createTestStore`, `createMockAlgodClient`, `createMockStoreAccessor`)
17. Remove `createWalletMap()` from `src/utils.ts`
18. Remove dead code: `deepMerge()`, `isValidWalletId()`, `isValidWalletKey()`
19. Remove `src/webpack.ts` (webpackFallback)
20. Remove all wallet implementation files from `src/wallets/` (keep `base.ts`, `types.ts`)
21. Remove `src/wallets/skins.ts` (moves to walletconnect adapter)
22. Update `src/wallets/index.ts` to only export `base.ts` and `types.ts`
23. Update `src/index.ts` exports
24. Update `LOCAL_STORAGE_KEY` to `@txnlab/use-wallet:v5`
25. Update core tests
26. Verify core builds and typechecks cleanly

### Sprint 2: Wallet Adapter Extraction

Create adapter packages, starting with one to establish the pattern, then batch the rest.

1. Create shared build configs (`packages/wallets/tsconfig.base.json`, `tsup.config.base.ts`, `vitest.config.base.ts`)
2. Create adapter package template (package.json extending shared configs)
3. Extract Pera adapter — establish the full pattern (including `manageWalletConnectSession` as local method)
4. Extract Defly adapter (including `manageWalletConnectSession` as local method)
5. Extract Defly Web adapter
6. Extract Exodus adapter
7. Extract WalletConnect adapter (with skins support, moved from `src/wallets/skins.ts`)
8. Extract Web3Auth adapter
9. Extract Mnemonic adapter
10. Extract KMD adapter
11. Extract Magic adapter
12. Extract Lute adapter
13. Extract Kibisis adapter
14. Extract Biatec adapter
15. Extract W3Wallet adapter
16. Extract Custom adapter
17. Verify all adapter packages build and typecheck
18. Add/migrate tests for each adapter (using `@txnlab/use-wallet/testing` helpers)

### Sprint 3: Framework Adapter Updates

Move directories, update imports, remove wallet SDK dependencies.

1. Move `packages/use-wallet-react/` → `packages/frameworks/react/`
2. Move `packages/use-wallet-vue/` → `packages/frameworks/vue/`
3. Move `packages/use-wallet-solid/` → `packages/frameworks/solid/`
4. Move `packages/use-wallet-svelte/` → `packages/frameworks/svelte/`
5. Update framework adapters to import `Wallet` interface from core
6. Remove wallet SDK peer dependencies from all framework adapter `package.json` files
7. Align Solid adapter to return `Wallet` objects (match React/Vue/Svelte pattern)
8. Update framework adapter tests
9. Verify all framework adapters build and typecheck

### Sprint 4: Examples, Docs, CI, Release Pipeline

Update everything that consumes the packages. Set up automated releases.

1. Update React example to v5 API
2. Update Vue example to v5 API
3. Update SolidJS example to v5 API
4. Update Svelte example to v5 API
5. Update vanilla TypeScript example to v5 API
6. Update Next.js example to v5 API (remove webpack fallback config)
7. Update Nuxt example to v5 API
8. Update root `package.json` build scripts for new directory structure
9. Update `.github/workflows/ci.yml` (PR-only triggers, add publint, add concurrency)
10. Update `.vscode/settings.json` ESLint working directories
11. Update `.github/renovate.json`
12. Install semantic-release and plugins as root devDependencies
13. Create root `.releaserc.js` with pre-release branch config
14. Create `scripts/update-versions.mjs` (lockstep version bumping)
15. Create `scripts/publish-packages.mjs` (ordered multi-package publishing)
16. Add `publishConfig` with `access` and `provenance` to all publishable `package.json` files
17. Add root `publint` script
18. Create `.github/workflows/release.yml` (TxnLab Release Bot, OIDC)
19. Add `CHANGELOG.md` to `.prettierignore`
20. Manual first publish of all new packages to npm
21. Configure npm trusted publishing (OIDC) for each package on npmjs.com
22. Update GitBook documentation
23. Write v4 → v5 migration guide
24. E2E test updates
25. Pre-release testing from `v5` branch

---

## 11. Consumer Migration Guide (v4 → v5)

### Step 1: Install wallet adapter packages

```bash
# Before (v4)
npm install @txnlab/use-wallet-react

# After (v5) — add a package for each wallet you use
npm install @txnlab/use-wallet-react @txnlab/use-wallet-pera @txnlab/use-wallet-defly
```

### Step 2: Update WalletManager configuration

```typescript
// Before (v4)
import { WalletManager, WalletId } from '@txnlab/use-wallet-react'

const manager = new WalletManager({
  wallets: [
    WalletId.PERA,
    { id: WalletId.DEFLY, options: { ... } },
  ],
})

// After (v5)
import { WalletManager } from '@txnlab/use-wallet-react'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [
    pera(),
    defly({ ... }),
  ],
})
```

### Step 3: Update WalletId references

```typescript
// Before (v4)
import { WalletId } from '@txnlab/use-wallet-react'
if (wallet.id === WalletId.PERA) { ... }

// After (v5)
if (wallet.id === 'pera') { ... }
// or
import { WALLET_ID } from '@txnlab/use-wallet-pera'
if (wallet.id === WALLET_ID) { ... }
```

### Step 4: Remove webpack fallback (Next.js)

```typescript
// Before (v4) — next.config.js
const { webpackFallback } = require('@txnlab/use-wallet')
module.exports = {
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, ...webpackFallback }
    return config
  },
}

// After (v5) — remove entirely, no longer needed
module.exports = {}
```

### Step 5: Users will need to reconnect wallets

The localStorage key changes from `v4` to `v5`. Active sessions will not carry over. Users reconnect their wallets once.

### What stays the same

- `useWallet()` hook — same return shape, same API
- `useNetwork()` hook — unchanged
- `WalletProvider` / plugin / context setup — unchanged (just different config)
- `WalletAccount` type — unchanged (additive optional `metadata` field)
- `signTransactions()`, `transactionSigner()` — unchanged
- `signData()`, `withPrivateKey()` — unchanged call signatures (the data signing types are renamed with a `Std` prefix — see §4.9)
- Network configuration — unchanged
