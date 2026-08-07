# @txnlab/use-wallet-mnemonic

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-mnemonic)](https://www.npmjs.com/package/@txnlab/use-wallet-mnemonic)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Mnemonic Wallet adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-mnemonic
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { mnemonic } from '@txnlab/use-wallet-mnemonic'

const manager = new WalletManager({
  wallets: [mnemonic()]
})
```

**For testing only** — never use with real assets. Not available on MainNet. Supports scoped private key access via `withPrivateKey`. Options: `persistToStorage`, `promptForMnemonic`.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
