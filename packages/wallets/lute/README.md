# @txnlab/use-wallet-lute

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-lute)](https://www.npmjs.com/package/@txnlab/use-wallet-lute)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Lute Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-lute
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { lute } from '@txnlab/use-wallet-lute'

const manager = new WalletManager({
  wallets: [lute()]
})
```

Web-based wallet with Ledger support. Also supports ARC-60 data signing (`signData`). Options: `siteName`.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
