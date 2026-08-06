# use-wallet v5 Migration Progress

Reference: [v5-migration-plan.md](./v5-migration-plan.md)

---

## Sprint 1: Core Foundation

- [x] Move `packages/use-wallet/` → `packages/core/`
- [x] Update `pnpm-workspace.yaml` to `packages/**`
- [x] Make `BaseWallet` generic: `BaseWallet<TOptions>`
- [x] Define `WalletAdapterConfig`, `AdapterConstructorParams<TOptions>`, `AdapterStoreAccessor` interfaces
- [x] Implement `WalletManager.createStoreAccessor()` for scoped store access
- [x] Refactor `WalletManager` to accept `WalletAdapterConfig[]`
- [x] Add event emitter to `WalletManager` (define full `WalletManagerEvents` surface)
- [x] Convert `WalletId` from enum to string type
- [x] Simplify `WalletKey` to `string`
- [x] Remove `WalletMap`, `WalletOptionsMap`, `WalletConfigMap` and related types
- [x] Remove `manageWalletConnectSession()` from `BaseWallet`
- [x] Add `updateMetadata()` protected method to `BaseWallet`
- [x] Add optional `metadata` field to `WalletAccount` type
- [x] Move `Wallet` interface definition to core
- [x] Set up subpath exports: `@txnlab/use-wallet/adapter` and `@txnlab/use-wallet/testing`
- [x] Create `@txnlab/use-wallet/testing` helpers (`createTestStore`, `createMockAlgodClient`, `createMockStoreAccessor`)
- [x] Remove `createWalletMap()` from `src/utils.ts`
- [x] Remove dead code: `deepMerge()`, `isValidWalletId()`, `isValidWalletKey()`
- [x] Remove `src/webpack.ts`
- [x] Remove all wallet implementation files from `src/wallets/`
- [x] Remove `src/wallets/skins.ts`
- [x] Update `src/wallets/index.ts` exports
- [x] Update `src/index.ts` exports
- [x] Update `LOCAL_STORAGE_KEY` to `@txnlab/use-wallet:v5`
- [x] Update core tests
- [x] Verify core builds and typechecks

## Sprint 2: Wallet Adapter Extraction

- [x] Fix `setActiveAccount` bug in `AdapterStoreAccessor`
- [x] Export `setActiveAccount` from `/adapter` subpath
- [x] Export `deriveAlgorandAccountFromEd25519` from `/adapter` subpath
- [x] Create shared build configs (`packages/wallets/tsconfig.base.json`, `tsup.config.base.ts`, `vitest.config.base.ts`)
- [x] Create adapter package template (package.json extending shared configs)
- [x] Extract Pera adapter (establish pattern, include local `manageWalletConnectSession`)
- [x] Extract Defly adapter (include local `manageWalletConnectSession`)
- [x] Extract Defly Web adapter
- [x] Extract Exodus adapter
- [x] Extract WalletConnect adapter (with skins from `src/wallets/skins.ts`)
- [x] Extract Web3Auth adapter
- [x] Extract Mnemonic adapter
- [x] Extract KMD adapter
- [x] Extract Magic adapter
- [x] Extract Lute adapter
- [x] Extract Kibisis adapter
- [x] ~~Extract Biatec adapter~~ — Removed: Biatec is a built-in skin in `@txnlab/use-wallet-walletconnect` (`skin: 'biatec'`)
- [x] Extract W3Wallet adapter
- [x] Extract Custom adapter
- [x] Verify all adapter packages build and typecheck
- [x] Add/migrate tests for each adapter (using `@txnlab/use-wallet/testing` helpers)
- [x] Delete `_v4-wallet-implementations/` directory

## Sprint 3: Framework Adapter Updates

**Pre-work (wallet adapter cleanup from Sprint 2 review):**
- [x] Move adapter test files from `src/__tests__/adapter.test.ts` to `src/adapter.test.ts` in all wallet adapter packages
- [x] Extract inline SVG icons to separate `icon.ts` files in all wallet adapter packages
- [x] Move Custom wallet adapter from `packages/wallets/custom/` to core (`packages/core/`), export from `@txnlab/use-wallet`

**Framework adapter updates:**
- [x] Move `packages/use-wallet-react/` → `packages/frameworks/react/`
- [x] Move `packages/use-wallet-vue/` → `packages/frameworks/vue/`
- [x] Move `packages/use-wallet-solid/` → `packages/frameworks/solid/`
- [x] Move `packages/use-wallet-svelte/` → `packages/frameworks/svelte/`
- [x] Import `Wallet` interface from core in all framework adapters
- [x] Remove wallet SDK peer dependencies from framework adapter package.json files
- [x] Align Solid adapter to return `Wallet` objects
- [x] Update framework adapter tests
- [x] Verify all framework adapters build and typecheck

## Sprint 4: Examples, Docs, CI, Release Pipeline

- [x] Update React example to v5 API (rebuilt with Vite v7, React 19)
- [x] Update Vue example to v5 API (rebuilt with Vite v7, Vue 3.5)
- [x] Update SolidJS example to v5 API (rebuilt with Vite v7, Solid 1.9)
- [x] Update Svelte example to v5 API (rebuilt with SvelteKit, Svelte 5, adapter-static)
- [x] Update vanilla TypeScript example to v5 API (rebuilt with Vite v7)
- [x] Update Next.js example (rebuilt with Next.js 16, Turbopack, no webpack fallback needed)
- [x] Update Nuxt example to v5 API (rebuilt with Nuxt 3.21, SSR disabled)
- [x] Update root `package.json` build scripts
- [x] Update `.github/workflows/ci.yml` (PR-only triggers, add publint, add concurrency)
- [x] Update `.vscode/settings.json` ESLint working directories
- [x] Update `.github/renovate.json`
- [x] Install semantic-release and plugins as root devDependencies
- [x] Create root `.releaserc.js` with pre-release branch config (`v5` → rc, `main` → stable)
- [x] Create `scripts/update-versions.mjs` (lockstep version bumping)
- [x] Create `scripts/publish-packages.mjs` (ordered multi-package publishing)
- [x] Add `publishConfig` (`access`, `provenance`) to all publishable `package.json` files
- [x] Add root `publint` script
- [x] Create `.github/workflows/release.yml` (TxnLab Release Bot, OIDC)
- [x] Add `CHANGELOG.md` to `.prettierignore`
- [x] Pre-release testing from `v5` branch

## Sprint 5: API Changes & Tooling

**Track A — API Changes:**
- [x] Rename `resetNetwork` → `persistNetwork`, flip default to `false` (breaking change)
- [x] Add wallet adapter capabilities (network filtering)
  - [x] Define `WalletCapabilities` type in core (`supportedNetworks` + `excludedNetworks`)
  - [x] Add `capabilities` field to `WalletAdapterConfig` and factory function returns
  - [x] Declare network capabilities in each wallet adapter's factory function
  - [x] Add `availableWallets` getter to `WalletManager` (filtered by active network)
  - [x] Add reactive `availableWallets` to framework adapters (`wallets` unchanged)
  - [x] Update core and framework adapter tests

**Track B — Tooling/Build:**
- [x] Migrate tsup → tsdown (all packages)
- [x] Drop CJS from build output (ESM only)
- [x] Migrate ESLint v8 → v9 (legacy `.eslintrc.json` → flat `eslint.config.js`)
- [x] Pin exact dependency versions in all packages (remove `^` ranges)
- [x] Fix publint `pkg.repository.url` warning (add `git+` prefix)

**Track C — Bug Fixes:**
- [x] Disconnect incompatible wallets on network switch (store subscription in `WalletManager`)
- [x] Fix Next.js hydration error (`isReady` guard in example components)

## Sprint 6: Docs, Publishing & E2E

- [ ] Manual first publish of all new packages to npm
- [ ] Configure npm trusted publishing (OIDC) for each package on npmjs.com
- [x] Update GitBook documentation
- [x] Write v4 → v5 migration guide
- [x] E2E test updates

---

## Findings & Decisions

- **2026-03-05**: ~~`BaseWallet.setActiveAccount()` in v5 uses `this.store.setAccounts()` (scoped accessor) instead of the v4 `setActiveAccount(this.store, ...)` pattern.~~ **BUG**: This doesn't work — `setAccounts` with the same accounts array preserves the existing active account. The `AdapterStoreAccessor` needs a `setActiveAccount(address: string)` method. **Fixed** — added `setActiveAccount` to `AdapterStoreAccessor` interface and implementation.
- **2026-03-05**: `exactOptionalPropertyTypes` in tsconfig required conditional assignment of `options` in `WalletManager.initializeWallets()` — can't pass `options: config.options` when `config.options` might be `undefined` and the target type uses `options?: TOptions`.
- **2026-03-05**: Package exports field requires `types` condition first (before `import`/`require`) to avoid esbuild warnings about unused conditions.
- **2026-03-05**: `WalletState` type is now defined in `wallets/types.ts` (alongside other wallet types) and re-exported from `store.ts` for backward compatibility. This keeps all wallet-related types in one place.
- **2026-03-05**: Biatec adapter removed as standalone package. Biatec was deprecated in v4 (PR #412) in favor of WalletConnect skins. In v5, use `walletConnect({ projectId: '...', skin: 'biatec' })` from `@txnlab/use-wallet-walletconnect`.
- **2026-03-05**: Adapter packages omit `exactOptionalPropertyTypes` from their tsconfig because the `WalletAdapterConfig` interface uses type erasure (`Record<string, unknown>`) which conflicts with specific options interfaces.
- **2026-03-05**: Factory functions in adapter packages require double cast (`as unknown as WalletAdapterConfig['Adapter']`) for the `Adapter` field and (`as unknown as Record<string, unknown>`) for `options` due to type erasure in `WalletAdapterConfig`.
- **2026-03-05**: Web3Auth adapter uses ambient module declarations (`web3auth-modules.d.ts`) for optional peer deps (`@web3auth/modal`, `@web3auth/base`, etc.) since they're dynamically imported at runtime and may not be installed during build.
- **2026-03-05**: Adapter icons should be stored as `.svg` files and imported as raw strings via tsup/build tooling, rather than inlined as base64 constants in adapter.ts. Cleaner separation of assets from logic. Apply during Sprint 3 pre-work.
- **2026-03-05**: Custom wallet adapter moves to core (`@txnlab/use-wallet`). It's a template/extension point for inline wallets, not a real wallet — conceptually part of the framework. Remove `packages/wallets/custom/` and add Custom to core exports. Apply during Sprint 3 pre-work.
- **2026-03-05**: Adapter test files should live alongside source (`src/adapter.test.ts`) rather than in `src/__tests__/adapter.test.ts`. Colocate during Sprint 3 pre-work.
- **2026-03-05**: Svelte adapter defines its own local `Wallet` interface (with `{ current: value }` reactive store wrappers) instead of importing the core `Wallet`. This is intentional — Svelte 5's `@tanstack/svelte-store` wraps reactive values in `{ current }`, making the flat core interface unusable directly. The core `Wallet` is still re-exported via `export * from '@txnlab/use-wallet'` for consumers who need the flat type.
- **2026-03-06**: **Magic SDK upgrade (v28 → v33)**: Updated `magic-sdk` from `^28.0.0` to `^33.5.0`, `@magic-ext/algorand` from `^23.0.0` to `^28.4.0`. Dropped `@magic-sdk/provider` as a direct dependency — `magic-sdk` re-exports `InstanceWithExtensions`, `SDKBase`, and all types. Breaking change in `@magic-sdk/types@27.1.0`: `MagicUserMetadata.publicAddress` removed, replaced by `wallets` object with per-chain entries (`wallets.algorand?.publicAddress`). The ESM build issue (`@magic-sdk/provider` shipping CJS in `.mjs`) is fixed in v33 — removed the Vite alias workaround from the React example. Other notable changes across v29-v33: `user.getMetadata()` removed (use `getInfo()`), `@magic-sdk/commons` removed, EVM-specific method renames — none of these affect the Algorand adapter.
- **2026-03-06**: **Web3Auth SDK upgrade (v9 → v10)**: Updated `@web3auth/modal` from `^9.7.0` to `^10.15.0`. Removed `@web3auth/base` as a direct dependency — `WEB3AUTH_NETWORK` and `CHAIN_NAMESPACES` are now re-exported from `@web3auth/modal` v10. Kept `@web3auth/base-provider@^9.5.0` because `@web3auth/single-factor-auth@^9.5.0` (still at v9, no v10 release) requires `CommonPrivateKeyProvider` with explicit Algorand chain config. Modal SDK v10 no longer requires `CommonPrivateKeyProvider` or client-side chain config for non-EVM chains — the provider is handled internally. `initModal()` replaced by `init()`. All other APIs unchanged: `connect()`, `logout()`, `getUserInfo()`, `provider.request({ method: 'private_key' })`. `Web3AuthOptions` type unchanged — no breaking changes to the adapter's public API. Web3Auth v9 EOL is December 2025.
- **2026-03-06**: **Dependency model change**: Wallet SDKs move from `peerDependencies` to regular `dependencies` in adapter packages. Peer deps forced consumers to manually install each wallet SDK alongside each adapter (28 packages for a full setup). With regular deps, `npm install @txnlab/use-wallet-pera` brings in `@perawallet/connect` automatically. `algosdk` stays as a peer dep since consumers use it directly. Web3Auth adapter must add `@web3auth/modal`, `@web3auth/base`, `@web3auth/base-provider`, `@web3auth/single-factor-auth` as regular deps (they were invisible before — not listed as peer deps despite being required at runtime). The Web3Auth ambient module declarations (`web3auth-modules.d.ts`) can be removed since the packages will be installed. Magic SDK has a broken ESM build (`@magic-sdk/types` missing `Wallets` export) — document the required Vite workaround until upstream fixes it.
- **2026-03-06**: **Solid adapter reactivity fix**: The v5 Solid adapter's `transformToWallet()` created plain objects with static property values — `isConnected`, `isActive`, `accounts`, `activeAccount` were captured once and never updated. Solid's fine-grained reactivity requires reactive accessors, not static values. Fixed by using JavaScript getter properties that re-evaluate from the store on each access (e.g., `get isConnected() { return !!walletStateMap()[wallet.walletKey] }`). The `wallets` array is created once (not wrapped in `createMemo`) since the wallet list is static — only the dynamic properties need getters. The Solid adapter now defines its own local `Wallet` interface with `readonly` properties (matching the Svelte adapter precedent of framework-specific `Wallet` types). The core `Wallet` is still re-exported for consumers who need the flat type.
- **2026-03-06**: **Example project directory renames**: Standardized example directory names to match framework adapter names: `vue-ts` → `vue`, `solid-ts` → `solid`, `svelte-ts` → `svelte`, `nextjs` → `next`. `vanilla-ts` kept as-is (no framework name to shorten to). `nuxt` already clean. Updated root `package.json` example scripts to match.
- **2026-03-06**: **`resetNetwork` → `persistNetwork`**: Renamed and flipped default. v4's `resetNetwork` defaulted to `false`, meaning the persisted network always overrode `defaultNetwork` — a common pain point for apps switching from TestNet to MainNet. v5's `persistNetwork` defaults to `false` (network resets to `defaultNetwork` on load). Apps with runtime network switching set `persistNetwork: true`. The rename eliminates the double-negative confusion of `resetNetwork: false`.
- **2026-03-07**: **Wallet adapter capabilities**: Chose option 5 (`supportedNetworks` + `excludedNetworks`) for `WalletCapabilities`. Most wallets use `supportedNetworks` to list 1-2 networks. Mnemonic uses `excludedNetworks: ['mainnet']` to support all networks except MainNet (including custom networks). If both are set, `supportedNetworks` wins with a warning. `wallets` is unchanged (returns all wallets). New `availableWallets` property added to `WalletManager` and all framework adapters — reactively filtered by active network. `WalletCapabilities` exported from `@txnlab/use-wallet` for third-party adapter authors.
- **2026-03-06**: **Build tooling**: Migrating tsup → tsdown (tsup EOL, recommends tsdown). Dropping CJS build output — ESM only for v5. All framework targets and examples are ESM-first.
- **2026-03-06**: **ESLint v9**: Migrating from ESLint v8 (legacy `.eslintrc.json`) to ESLint v9 (flat `eslint.config.js`). Removes `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` in favor of `typescript-eslint` unified package.
- **2026-03-06**: **Pinned dependency versions**: All packages use exact versions (no `^` ranges). Renovate handles version bumps.
- **2026-03-07**: **E2E test updates**: Updated Playwright tests in `examples/e2e-tests/` for the v5 example UI. Tests target the vanilla-ts example (uses `data-*` attributes for stable selectors). Added `playwright.config.ts` at root and `test:e2e`/`test:e2e:ui` scripts. Three test suites: Mnemonic wallet connect/disconnect/send-transaction, network switching with `availableWallets` filtering (verifies Mnemonic disappears on mainnet), and transaction error handling. Tests use `FakeAlgodResponses.ts` to mock Algod HTTP endpoints — no real node needed. E2E tests are local-only (not in CI) — the cost of Chromium install + build per PR isn't justified for demo-level smoke tests. Can add CI integration later if comprehensive E2E coverage is added.
- **2026-03-07**: **v4 → v5 migration guide**: Created `docs/guides/migrating-from-v4.x.md` covering all breaking changes: wallet adapter packages, factory function configuration, `resetNetwork` → `persistNetwork`, type changes, removed features, new features (`availableWallets`, event emitter, subpath exports), and localStorage key change. Follows the structure of the existing v3 → v4 guide with GitBook formatting.
- **2026-03-07**: **GitBook documentation update**: Updated all docs in `docs/` for v5 API. Replaced `WalletId` enum usage with factory function imports across installation, configuration, supported wallets, API reference, framework adapters, and guide pages. Removed Webpack configuration section (not needed in v5), Biatec standalone section (removed in v5), and Liquid Auth section (removed in v5). Added `availableWallets` to API reference. Updated example project directory names and descriptions. Deleted `migrating-from-v3.x.md` (stays in v4 GitBook space). v5 docs will be deployed to a separate `gitbook/v5` branch.

---

## Open Issues

- [x] **`setActiveAccount` bug**: Fixed — added `setActiveAccount(address: string)` to `AdapterStoreAccessor`, implemented in `WalletManager.createStoreAccessor()`, updated `BaseWallet.setActiveAccount()`.
- [x] **`setActiveAccount` not exported from `/adapter`**: Fixed — now exported from `@txnlab/use-wallet/adapter`.
- [x] **Adapter tests not yet migrated**: Tests migrated to adapter packages using `@txnlab/use-wallet/testing` helpers.
- [x] **Move wallet SDKs from `peerDependencies` to `dependencies`** in all adapter packages. Removed Web3Auth ambient module declarations. Updated migration plan §2 (Dependency Graph) and §5.2 (package.json template).
- [x] **Magic SDK ESM bug**: Fixed by upgrading to `magic-sdk@^33.5.0`. The `@magic-sdk/provider` ESM build issue is resolved in v33. Removed the Vite alias workaround from the React example.
- [x] **Upgrade Magic SDK** from v28 to v33. Updated `magic-sdk` to `^33.5.0`, `@magic-ext/algorand` to `^28.4.0`. Dropped `@magic-sdk/provider` as a direct dependency (re-exported from `magic-sdk`). Key API change: `MagicUserMetadata.publicAddress` replaced by `wallets.algorand?.publicAddress` in `@magic-sdk/types@27.1.0+`. Updated adapter `connect()` and `resumeSession()` methods accordingly.
- [x] **Upgrade Web3Auth SDK** from v9 to v10. Updated `@web3auth/modal` from `^9.7.0` to `^10.15.0`. Removed `@web3auth/base` as a direct dependency (re-exported from `@web3auth/modal` v10). Kept `@web3auth/base-provider@^9.5.0` for SFA SDK compatibility. `@web3auth/single-factor-auth` remains at `^9.5.0` (no v10 release). Key API changes: `initModal()` replaced by `init()`, chain config and `CommonPrivateKeyProvider` no longer needed for Modal SDK v10 (handled internally for non-EVM chains), `WEB3AUTH_NETWORK` and `CHAIN_NAMESPACES` now importable from `@web3auth/modal`. SFA path still requires `CommonPrivateKeyProvider` with explicit chain config. No changes to `Web3AuthOptions` type — the public API is unchanged.
- [x] **Custom adapter test TypeScript error**: Fixed — made `connect` optional in `CustomProvider` type to match runtime behavior. Removed `@ts-expect-error` from test.
- [x] **Framework adapter tests in `__tests__/`**: Colocated all framework adapter tests alongside source files. Also moved core `custom.test.ts` to `src/wallets/`.
- [x] **React example uses Vite v6**: Rebuilt with Vite v7 starter template (Vite 7.3, React 19, flat ESLint config, new tsconfig structure). Apply same pattern to remaining examples.
- [x] **Solid adapter reactivity broken**: `useWallet()` returned `Wallet` objects with static properties that didn't update when store state changed. Fixed by using getter properties on `Wallet` objects that re-evaluate from the store on each access. Defined a Solid-specific `Wallet` interface with `readonly` modifiers (precedent: Svelte adapter).
