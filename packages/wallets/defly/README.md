# @txnlab/use-wallet-defly

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-defly)](https://www.npmjs.com/package/@txnlab/use-wallet-defly)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Defly Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-defly
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { defly } from '@txnlab/use-wallet-defly'

const manager = new WalletManager({
  wallets: [defly()]
})
```

Supports MainNet and TestNet. Options: `bridge`, `shouldShowSignTxnToast`, `chainId`.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
