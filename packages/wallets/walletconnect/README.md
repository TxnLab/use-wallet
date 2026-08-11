# @txnlab/use-wallet-walletconnect

[![npm version](https://img.shields.io/npm/v/@txnlab/use-wallet-walletconnect)](https://www.npmjs.com/package/@txnlab/use-wallet-walletconnect)
[![License](https://img.shields.io/github/license/TxnLab/use-wallet)](https://github.com/TxnLab/use-wallet/blob/main/LICENSE)

WalletConnect adapter for [use-wallet](https://github.com/TxnLab/use-wallet), the Algorand wallet integration library.

## Installation

```bash
npm install @txnlab/use-wallet @txnlab/use-wallet-walletconnect
```

If you use a framework adapter (`@txnlab/use-wallet-react`, `-vue`, `-solid`, or `-svelte`), install it in place of `@txnlab/use-wallet`.

## Usage

```typescript
import { WalletManager } from '@txnlab/use-wallet'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'

const manager = new WalletManager({
  wallets: [walletConnect({ projectId: 'your-project-id' })]
})
```

Connect any [WalletConnect](https://walletconnect.network/)-compatible Algorand wallet. Requires a `projectId` from [Reown Dashboard](https://dashboard.reown.com). Supports skins for white-labeled instances (e.g. `walletConnect({ projectId, skin: 'biatec' })`). Note: the `metadata` option is WalletConnect's dApp metadata sent to the relay — use a custom `skin` to override display name and icon.

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!
