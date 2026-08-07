# @txnlab/use-wallet-pera

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-pera)](https://www.npmjs.com/package/@txnlab/use-wallet-pera)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Pera Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-pera
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { pera } from '@txnlab/use-wallet-pera'

const manager = new WalletManager({
  wallets: [pera()]
})
```

Supports MainNet and TestNet. Options: `bridge`, `shouldShowSignTxnToast`, `chainId`, `compactMode`.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
