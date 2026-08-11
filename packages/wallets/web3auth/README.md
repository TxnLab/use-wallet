# @txnlab/use-wallet-web3auth

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-web3auth)](https://www.npmjs.com/package/@txnlab/use-wallet-web3auth)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

Web3Auth adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-web3auth
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { web3auth } from '@txnlab/use-wallet-web3auth'

const manager = new WalletManager({
  wallets: [web3auth({ clientId: 'your-client-id' })]
})
```

Social login authentication (Google, Facebook, X, Discord, and more) via [Web3Auth](https://web3auth.io). Requires a `clientId` from the [Web3Auth Dashboard](https://dashboard.web3auth.io). Supports scoped private key access via `withPrivateKey`. Supports MainNet only.

The factory also accepts an optional `metadata` option to override the wallet's display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
