# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

@txnlab/use-wallet is a framework-agnostic Algorand wallet integration library with reactive framework adapters for React, Vue, SolidJS, and Svelte. It enables dApps to connect to various Algorand wallets, sign transactions, and manage wallet sessions.

## Commands

### Development

```bash
pnpm install              # Install dependencies
pnpm dev                  # Watch mode for all packages
pnpm build:packages       # Build all packages
pnpm build                # Build packages and examples
```

### Testing

```bash
pnpm test                                         # Run all tests
pnpm --filter @txnlab/use-wallet test             # Run core package tests
pnpm --filter @txnlab/use-wallet test:watch       # Watch mode for core tests
```

### Linting & Type Checking

```bash
pnpm lint                 # Lint all packages
pnpm typecheck            # Type check all packages
pnpm format:check         # Check formatting with Prettier
pnpm publint              # Check package.json and dist output
```

### Running Examples

```bash
pnpm example:react        # React example
pnpm example:vue          # Vue example
pnpm example:solid        # SolidJS example
pnpm example:svelte       # Svelte example
pnpm example:next         # Next.js example
pnpm example:nuxt         # Nuxt example
pnpm example:ts           # Vanilla TypeScript example
```

## Architecture

### Package Structure (pnpm monorepo)

All 13 publishable packages use lockstep versioning — every package shares the same version number.

**Core** (`packages/core`):

- `@txnlab/use-wallet` — Core framework-agnostic library

**Wallet Adapters** (`packages/wallets/<name>`):

- `@txnlab/use-wallet-defly`, `-exodus`, `-walletconnect`, `-kibisis`, `-w3wallet`, `-kmd`, `-mnemonic`, `-web3auth`
- Each is a separate npm package that bundles its wallet SDK as a regular dependency
- Peer-depends on `@txnlab/use-wallet` via `workspace:^` (with `workspace:*` as a devDependency for local linking)

**Framework Adapters** (`packages/frameworks/<name>`):

- `@txnlab/use-wallet-react`, `-vue`, `-solid`, `-svelte`
- Depends on `@txnlab/use-wallet` via `workspace:*`
- Re-exports all core types and classes

### Core Package Architecture

**State Management**: Uses `@tanstack/store` for reactive state. State includes:

- `wallets`: Map of wallet IDs to their connection state (accounts, active account)
- `activeWallet`: Currently active wallet ID
- `activeNetwork`: Current network (mainnet, testnet, etc.)
- `algodClient`: Algorand SDK client instance

**Key Classes**:

- `WalletManager` (`src/manager.ts`): Orchestrates wallet initialization, network configuration, and state persistence. Entry point for configuring the library.
- `BaseWallet` (`src/wallets/base.ts`): Abstract base class all wallet implementations extend. Defines the wallet interface: `connect()`, `disconnect()`, `resumeSession()`, `signTransactions()`.

**Wallet Implementations** (`packages/wallets/*`): Each wallet provider has its own adapter package extending `BaseWallet`, with its wallet SDK bundled as a dependency. Users install only the adapter packages they need.

**v5 API**: Wallets are configured using factory functions (e.g., `pera()`, `defly()`) instead of the v4 `WalletId` enum. Wallet capabilities include `supportedNetworks`/`excludedNetworks` for filtering via `availableWallets`.

**Secure Key Utilities** (`src/secure-key.ts`): For wallets that handle raw private keys (Web3Auth, Mnemonic), provides `SecureKeyContainer` for safe key handling with automatic memory zeroing.

**State Persistence**: Wallet state is persisted to localStorage under key `@txnlab/use-wallet:v5`.

### Framework Adapter Pattern

Each adapter provides:

1. A context provider component (e.g., `WalletProvider` in React)
2. Hooks/composables that subscribe to store state and provide reactive wallet data
3. Re-exports of all core types and classes

## Releases and Commit Conventions

This project uses **semantic-release** for automated versioning and publishing. Commits to `main` and `next` trigger the release workflow.

### Commit types that trigger a release

| Type       | Bump  | Example                                     |
| ---------- | ----- | ------------------------------------------- |
| `feat`     | minor | `feat(core): add multi-account support`     |
| `fix`      | patch | `fix(pera): handle session timeout`         |
| `perf`     | patch | `perf(store): reduce state update overhead` |
| `refactor` | patch | `refactor(wallets): simplify base class`    |

### Commit types that DO NOT trigger a release

`chore`, `docs`, `style`, `test`, `build`, `ci`

### Important

- **Direct commits** to `main` or `next` with a release-triggering type (`feat`, `fix`, `perf`, `refactor`) will automatically publish new versions to npm.
- **Pull requests** into `main` or `next` are squash-merged (enforced by GitHub ruleset). The squash commit message determines whether a release is triggered.
- Use `chore`, `docs`, `test`, `ci`, or `build` prefixes for commits that should not trigger a release.
- The `next` branch publishes pre-release versions (e.g., `5.1.0-next.N`) to the `next` npm tag. The `main` branch publishes stable versions to `latest`.

### Prerelease flow (`next` branch)

`next` exists only during a prerelease cycle: it's created from `main` when the cycle starts and deleted when it's promoted. Creating, deleting and pushing to `next` all require a ruleset bypass.

- **Starting a cycle:** create `next` from the current `main` with `git fetch origin && git push origin refs/remotes/origin/main:refs/heads/next`. If a local `next` is left over from a previous cycle, delete it (`git branch -D next`) and check out the new one.
- Feature work for the next minor version targets `next`. Each release-type squash merge publishes a new `X.Y.Z-next.N` prerelease of every package.
- Dependency updates (Renovate) target `main` as `chore(deps)` and reach `next` when `main` is synced into it.
- **Syncing `main` into `next`** uses a merge commit, not a squash PR (squashing would drop `main`'s ancestry and cause conflicts at promotion). Branch from `origin/next`, `git merge --no-ff origin/main`, run the checks, then push the branch to `next`. Sync before promoting.
- **Promoting `next` to `main`** is a fast-forward, not a merge:
  1. Open a PR from `next` into `main` as a record of the release, and let CI pass.
  2. Run `git push origin refs/remotes/origin/next:refs/heads/main`, which moves `main` to `next`'s exact commits. git rejects it if `main` has commits `next` lacks; sync first.
  3. semantic-release publishes the stable version to `latest`. GitHub marks the PR merged and auto-deletes `next`, which ends the cycle.
  4. Locally, run `git fetch --prune` and `git branch -D next`.
- `chore` commits are hidden from the generated changelog, so add notable `chore` changes (e.g., adapters moving to other maintainers) to the release notes by hand.

### Release pipeline

1. Push to `main` or `next` triggers `.github/workflows/release.yml`
2. semantic-release determines the next version from commit history and git tags
3. `scripts/update-versions.mjs` updates every workspace package version (lockstep)
4. `scripts/publish-packages.mjs` publishes in dependency order: core → wallets → frameworks
5. `@semantic-release/git` commits the updated package.json files and CHANGELOG.md
6. Publishing uses OIDC trusted publishing (no npm token needed)

### Workspace references

Internal dependencies use `workspace:` references in package.json files, which `pnpm publish` resolves at publish time:

- `workspace:*` publishes as the exact version (framework adapters' `dependencies`, all `devDependencies`).
- `workspace:^` publishes as a caret range, e.g. `^5.1.0` (wallet adapters' `peerDependencies`, so an app's single copy of core satisfies every adapter).

Do not manually replace `workspace:` references with version strings — this breaks local development linking.

## ESLint Configuration

Uses TypeScript ESLint with `@typescript-eslint/no-explicit-any` disabled. Unused variables prefixed with `_` are allowed.
