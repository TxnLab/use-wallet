# @txnlab/use-wallet-magic

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-magic)](https://www.npmjs.com/package/@txnlab/use-wallet-magic)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Magic adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-magic
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { magic } from '@txnlab/use-wallet-magic'

const manager = new WalletManager({
  wallets: [magic({ apiKey: 'your-api-key' })]
})
```

Email-based authentication via [Magic](https://magic.link). Supports MainNet only.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
