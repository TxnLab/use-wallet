# @txnlab/use-wallet-w3wallet

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-w3wallet)](https://www.npmjs.com/package/@txnlab/use-wallet-w3wallet)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

W3 Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-w3wallet
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { w3wallet } from '@txnlab/use-wallet-w3wallet'

const manager = new WalletManager({
  wallets: [w3wallet()]
})
```

Multi-currency wallet with desktop, mobile, and browser extension support. Supports MainNet only.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
