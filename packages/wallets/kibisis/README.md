# @txnlab/use-wallet-kibisis

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-kibisis)](https://www.npmjs.com/package/@txnlab/use-wallet-kibisis)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Kibisis Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-kibisis
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { kibisis } from '@txnlab/use-wallet-kibisis'

const manager = new WalletManager({
  wallets: [kibisis()]
})
```

AVM-focused browser extension wallet supporting Algorand and Voi networks.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
