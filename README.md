# avm-wallet

[![GitHub package.json version](https://img.shields.io/github/package-json/v/TxnLab/avm-wallet?filename=packages%2Favm-wallet%2Fpackage.json&label=version)](https://www.npmjs.com/package/avm-wallet?activeTab=versions)
[![GitHub License](https://img.shields.io/github/license/scholtz/avm-wallet)](https://github.com/scholtz/avm-wallet/blob/main/LICENSE.md)

A framework agnostic Algorand wallet integration library with reactive framework adapters for React, Vue, and Solid.js.

## use-wallet fork

This is fork of use-wallet intended to fix multiple issues found in it:

- [Multiple AVM networks support](https://github.com/TxnLab/use-wallet/pull/222)
- [Biatec wallet support](https://github.com/TxnLab/use-wallet/pull/202)
- [Bug in Kibisis wallet for vuejs](https://github.com/TxnLab/use-wallet/pull/225)

Difference betwen `avm-wallet` and `use-wallet` is just the name of the import.

Example usage: https://github.com/AramidFinance/aramid-bridge-fe-vue/blob/c9e0bfe90122b7c8a9d56d2c2deac36f08098cd6/src/main.ts#L28

```
import { NetworkId, WalletId, WalletManagerPlugin } from 'avm-wallet-vue'

...

// Install the plugin
app.use(WalletManagerPlugin, {
  wallets: [
    WalletId.DEFLY,
    WalletId.PERA,
    WalletId.EXODUS,
    WalletId.KIBISIS,
    {
      id: WalletId.BIATEC,
      options: {
        projectId: '..'
      }
    },
    {
      id: WalletId.WALLETCONNECT,
      options: {
        projectId: '..'
      }
    }
  ],
  network: NetworkId.MAINNET
})

app.mount('#app')
```

## Features

- Easily add or remove wallet support with a few lines of code
- Configure each wallet provider as needed for your application
- Allow users to easily switch between active accounts and wallet providers
- Sign and send transactions
- Restore sessions for returning users
- Full TypeScript support

### Visit [txnlab.gitbook.io/use-wallet](https://txnlab.gitbook.io/use-wallet) for docs, guides, and examples!

### [Become a sponsor!](https://github.com/sponsors/TxnLab/)
