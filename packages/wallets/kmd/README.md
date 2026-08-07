# @txnlab/use-wallet-kmd

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-kmd)](https://www.npmjs.com/package/@txnlab/use-wallet-kmd)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

KMD (Key Management Daemon) adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-kmd
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { kmd } from '@txnlab/use-wallet-kmd'

const manager = new WalletManager({
  wallets: [kmd()]
})
```

Development wallet for Algorand LocalNet. Only available when the active network is LocalNet. Options: `wallet`, `token`, `baseServer`, `port`, `promptForPassword`.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
