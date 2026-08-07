# use-wallet

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet)](https://www.npmjs.com/package/@txnlab/use-wallet?activeTab=versions)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

A framework-agnostic Algorand wallet integration library with reactive adapters for React, Vue, SolidJS, and Svelte.

## Features

- **Modular wallet adapters** — install only the wallets you need; each wallet SDK is bundled in its own package
- **Factory function configuration** with full TypeScript support
- Switch between accounts, wallets, and networks reactively
- Sign and send transactions, ARC-60 data signing, session restore
- `availableWallets` list filtered by each wallet's declared network capabilities
- Typed event emitter for observing wallet lifecycle events
- ESM-only, tree-shakeable packages

## Quick Start

Install the framework adapter (or the core package for vanilla JS/TS) plus the wallet adapters you want to support:

```bash
npm install @txnlab/use-wallet-react @txnlab/use-wallet-pera @txnlab/use-wallet-defly algosdk
```

```tsx
import { WalletManager, WalletProvider, useWallet } from '@txnlab/use-wallet-react'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [pera(), defly()],
  defaultNetwork: 'testnet'
})

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourApp />
    </WalletProvider>
  )
}
```

## Packages

| Package | Description |
| --- | --- |
| [`@txnlab/use-wallet`](https://www.npmjs.com/package/@txnlab/use-wallet) | Core library (framework-agnostic) |
| [`@txnlab/use-wallet-react`](https://www.npmjs.com/package/@txnlab/use-wallet-react) | React adapter |
| [`@txnlab/use-wallet-vue`](https://www.npmjs.com/package/@txnlab/use-wallet-vue) | Vue adapter |
| [`@txnlab/use-wallet-solid`](https://www.npmjs.com/package/@txnlab/use-wallet-solid) | SolidJS adapter |
| [`@txnlab/use-wallet-svelte`](https://www.npmjs.com/package/@txnlab/use-wallet-svelte) | Svelte adapter |

Wallet adapters: [Pera](https://www.npmjs.com/package/@txnlab/use-wallet-pera) · [Defly](https://www.npmjs.com/package/@txnlab/use-wallet-defly) · [Defly Web](https://www.npmjs.com/package/@txnlab/use-wallet-defly-web) · [Exodus](https://www.npmjs.com/package/@txnlab/use-wallet-exodus) · [Kibisis](https://www.npmjs.com/package/@txnlab/use-wallet-kibisis) · [KMD](https://www.npmjs.com/package/@txnlab/use-wallet-kmd) · [Lute](https://www.npmjs.com/package/@txnlab/use-wallet-lute) · [Magic](https://www.npmjs.com/package/@txnlab/use-wallet-magic) · [Mnemonic](https://www.npmjs.com/package/@txnlab/use-wallet-mnemonic) · [W3 Wallet](https://www.npmjs.com/package/@txnlab/use-wallet-w3wallet) · [WalletConnect](https://www.npmjs.com/package/@txnlab/use-wallet-walletconnect) · [Web3Auth](https://www.npmjs.com/package/@txnlab/use-wallet-web3auth)

A `custom` provider (built into core) supports integrating any other wallet, and third-party adapter packages work without changes to this repository — see the [supported wallets](https://txnlab.gitbook.io/use-wallet/getting-started/supported-wallets) docs.

## Migrating from v4?

See the [v4 to v5 migration guide](https://txnlab.gitbook.io/use-wallet/guides/migrating-from-v4.x). v4 documentation remains available at [txnlab.gitbook.io/use-wallet/v4](https://txnlab.gitbook.io/use-wallet/v4).

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!

### [Become a sponsor!](https://github.com/sponsors/TxnLab/)
