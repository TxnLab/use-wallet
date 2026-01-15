# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important**: Keep this document updated when making significant changes to the codebase, such as adding new commands, changing architecture patterns, introducing new directories, or modifying the build/test setup.

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
pnpm prettier             # Check formatting
```

### Running Examples
```bash
pnpm example:react        # React example
pnpm example:vue          # Vue example
pnpm example:solid        # SolidJS example
pnpm example:svelte       # Svelte example
pnpm example:nextjs       # Next.js example
pnpm example:nuxt         # Nuxt example
pnpm example:ts           # Vanilla TypeScript example
```

## Architecture

### Package Structure (pnpm monorepo)

- **packages/use-wallet** (`@txnlab/use-wallet`) - Core framework-agnostic library
- **packages/use-wallet-react** (`@txnlab/use-wallet-react`) - React adapter
- **packages/use-wallet-vue** (`@txnlab/use-wallet-vue`) - Vue adapter
- **packages/use-wallet-solid** (`@txnlab/use-wallet-solid`) - SolidJS adapter
- **packages/use-wallet-svelte** (`@txnlab/use-wallet-svelte`) - Svelte adapter

Framework adapters depend on the core package via `workspace:*` and re-export all core exports.

### Core Package Architecture

**State Management**: Uses `@tanstack/store` for reactive state. State includes:
- `wallets`: Map of wallet IDs to their connection state (accounts, active account)
- `activeWallet`: Currently active wallet ID
- `activeNetwork`: Current network (mainnet, testnet, etc.)
- `algodClient`: Algorand SDK client instance

**Key Classes**:
- `WalletManager` (`src/manager.ts`): Orchestrates wallet initialization, network configuration, and state persistence. Entry point for configuring the library.
- `BaseWallet` (`src/wallets/base.ts`): Abstract base class all wallet implementations extend. Defines the wallet interface: `connect()`, `disconnect()`, `resumeSession()`, `signTransactions()`.

**Wallet Implementations** (`src/wallets/`): Each wallet provider (Pera, Defly, Exodus, WalletConnect, KMD, Web3Auth, etc.) has its own implementation extending `BaseWallet`. Wallet SDKs are peer dependencies, allowing users to install only what they need.

**Secure Key Utilities** (`src/secure-key.ts`): For wallets that handle raw private keys (Web3Auth, Mnemonic), provides `SecureKeyContainer` for safe key handling with automatic memory zeroing. Keys are never persisted and are cleared immediately after use.

**State Persistence**: Wallet state is persisted to localStorage under key `@txnlab/use-wallet:v4`.

### Framework Adapter Pattern

Each adapter provides:
1. A context provider component (e.g., `WalletProvider` in React)
2. Hooks/composables that subscribe to store state and provide reactive wallet data
3. Re-exports of all core types and classes

Example: React's `useWallet()` hook uses `@tanstack/react-store` to subscribe to state changes and returns reactive wallet data plus signing methods.

## Key Types

- `WalletId`: Enum of supported wallet IDs (PERA, DEFLY, EXODUS, WALLETCONNECT, KMD, WEB3AUTH, MAGIC, etc.)
- `WalletAccount`: `{ name: string, address: string }`
- `SupportedWallet`: Either a `WalletId` string or a config object `{ id, options?, metadata? }`

## ESLint Configuration

Uses TypeScript ESLint with `@typescript-eslint/no-explicit-any` disabled. Unused variables prefixed with `_` are allowed.
