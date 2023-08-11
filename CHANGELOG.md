# [2.1.1](https://github.com/txnlab/use-wallet/compare/v2.1.0...v2.1.1) (2023-08-11)

### Bug Fixes

- Deduplicate dependencies ([#105](https://github.com/TxnLab/use-wallet/pull/105)) ([de17bbe](https://github.com/TxnLab/use-wallet/commit/de17bbec85c3fc6dc16225f9eb276a5536252cd3))

# [2.1.0](https://github.com/txnlab/use-wallet/compare/v2.0.0...v2.1.0) (2023-08-07)

### Features

- enable dynamic import of wallet libraries ([#100](https://github.com/txnlab/use-wallet/pull/100)) ([57f38f3](https://github.com/txnlab/use-wallet/commit/57f38f3a748fd2f126b87f5fd0368ce175490c7e))

# [2.0.0](https://github.com/TxnLab/use-wallet/compare/v1.3.1...v2.0.0) (2023-06-27)

### Features

- Improved initializeProviders API ([#66](https://github.com/TxnLab/use-wallet/pull/66))
- WalletConnect 2.0 support ([#83](https://github.com/TxnLab/use-wallet/pull/83))
- Debug mode ([#89](https://github.com/TxnLab/use-wallet/pull/89))

### Changes

- Add unit tests ([#61](https://github.com/TxnLab/use-wallet/pull/61))

### Breaking Changes

- The function used to initialize providers in version 1.x is no longer exported by the library. Use the `useInitializeProviders` hook or manually construct the wallet providers map that gets passed to the `WalletProvider`.
- There is no longer a "default" provider configuration. All providers to be supported must be explicitly defined.
- Wallet provider peer dependencies (SDK/client libraries) are no longer dynamically imported behind the scenes. The modules must be statically imported and passed to the `clientStatic` property when initializing the provider.

## [1.3.3](https://github.com/txnlab/use-wallet/compare/v1.3.2...v1.3.3) (2023-06-24)

### Changes

- Upgrade `@blockshake/defly-connect` to v1.1.5 ([32c7bba](https://github.com/TxnLab/use-wallet/commit/32c7bbaadf432adf11bb802e46d4f2372d54a000))

## [1.3.2](https://github.com/txnlab/use-wallet/compare/v1.3.1...v1.3.2) (2023-06-21)

### Changes

- Upgrade `@blockshake/defly-connect` to v1.1.3 ([b25cbeb](https://github.com/TxnLab/use-wallet/commit/b25cbeb0f2046f29826e635fa5ac11f18d9c1156))

## [1.3.1](https://github.com/txnlab/use-wallet/compare/v1.3.0...v1.3.1) (2023-06-20)

### Features

- Handle nested transaction arrays in `signTransactions` ([#79](https://github.com/TxnLab/use-wallet/pull/79))

### Changes

- Update `signTransactions` type signature in `useWallet` hook

# [1.3.0](https://github.com/txnlab/use-wallet/compare/v1.2.12...v1.3.0) (2023-04-28)

### Features

- Daffi Wallet support ([#68](https://github.com/TxnLab/use-wallet/pull/68))
- Provider dependencies are optional ([#72](https://github.com/TxnLab/use-wallet/pull/72))

## [1.2.12](https://github.com/txnlab/use-wallet/compare/v1.2.11...v1.2.12) (2023-04-24)

### Bug Fixes

- Add missing unsigned txns to group in Defly client ([#69](https://github.com/TxnLab/use-wallet/pull/69))

## [1.2.11](https://github.com/txnlab/use-wallet/compare/v1.2.10...v1.2.11) (2023-03-29)

### Changes

- Fixes jest tests, initial CI pipeline, adding commitizen, starter config for automation tools ([#58](https://github.com/TxnLab/use-wallet/pull/58))

## [1.2.10](https://github.com/txnlab/use-wallet/compare/v1.2.9...v1.2.10) (2023-03-26)

### Bug Fixes

- Fixes dependency resolution errors on `npm install` for local development ([aea17fc](https://github.com/txnlab/use-wallet/commit/aea17fc16c8c6a7cb5fc7eff2536b882f462358c))

## [1.2.9](https://github.com/txnlab/use-wallet/compare/v1.2.8...v1.2.9) (2023-03-23)

### Bug Fixes

- Fix return type of `groupTransactionsBySender` in base client ([07ae640](https://github.com/txnlab/use-wallet/commit/07ae64096fbb37ed2216dc2ed85cbb4e5247e6a2))

## [1.2.8](https://github.com/txnlab/use-wallet/compare/v1.2.7...v1.2.8) (2023-03-23)

### Changes

- Upgrade @perawallet/connect to v1.2.1 ([496000c](https://github.com/txnlab/use-wallet/commit/496000c4258a3e639b1677b2839852a81a1d410f))

## [1.2.7](https://github.com/txnlab/use-wallet/compare/v1.2.6...v1.2.7) (2023-03-17)

### Features

- Migration to AlgoSigner v1.10.0, which adds support for rekeyed signing ([fbff1ee](https://github.com/txnlab/use-wallet/commit/fbff1eef35b8525c389309d0500ab20cfcd27dbd))

### Changes

- ESLint added and source files formatted following the new ESLint/Prettier config ([77b8f03](https://github.com/txnlab/use-wallet/commit/77b8f03fe9fa2236de0c8d6a3c1000c333b50a10))

## [1.2.6](https://github.com/txnlab/use-wallet/compare/v1.2.5...v1.2.6) (2023-03-14)

### Bug Fixes

- Handle varying payload lengths in WalletConnect `signTransactions` method ([79a9228](https://github.com/txnlab/use-wallet/commit/79a92286a86d8760a925e7ba4bee92069a01d2d2))

## [1.2.5](https://github.com/TxnLab/use-wallet/compare/v1.2.4...v1.2.5) (2023-03-14)

### Bug Fixes

- Fix handling signed transactions in WalletConnect client ([c973514](https://github.com/txnlab/use-wallet/commit/c9735148ac9a083dfef10ba0c6e3271011030c32))

## [1.2.4](https://github.com/TxnLab/use-wallet/compare/v1.2.3...v1.2.4) (2023-03-11)

### Changes

- Only reconnect to active providers in `reconnectProviders` ([0a48316](https://github.com/txnlab/use-wallet/commit/0a48316923c0f9652fee15aca1b571b4f3ccb16f))

## [1.2.3](https://github.com/txnlab/use-wallet/compare/v1.2.2...v1.2.3) (2023-03-06)

### Changes

- Upgrade `@perawallet/connect` to `v1.1.1`, which adds Ledger support for Pera Web Wallet

## [1.2.2](https://github.com/txnlab/use-wallet/compare/v1.2.1...v1.2.2) (2023-02-07)

### Changes

- Upgrade `algosdk` so that polyfills for `Buffer` and `Crypto` globals are no longer necessary.

## [1.2.1](https://github.com/txnlab/use-wallet/compare/v1.2.0...v1.2.1) (2023-01-25)

### Features

- Support signing transaction groups from multiple accounts with Pera

### Bug Fixes

- Fill in MyAlgo logo so that it shows up in dark backgrounds ([#42](https://github.com/txnlab/use-wallet/issues/42)) ([d982c95](https://github.com/txnlab/use-wallet/commit/d982c958d6f664258c5331aeff9fe69975d6bfc1))

### Changes

- Remove deprecated functions

# [1.2.0](https://github.com/TxnLab/use-wallet/compare/v1.1.6...v1.2.0) (2023-01-19)

### Features

- adding algoworld swapper to `used by` ([#29](https://github.com/txnlab/use-wallet/issues/29)) ([1bca5ab](https://github.com/txnlab/use-wallet/commit/1bca5ab15d72076e5430b200f178ee76a7b8c7d9))
- adding new mnemonic wallet provider for e2e testing ([#28](https://github.com/txnlab/use-wallet/issues/28)) ([ca38100](https://github.com/txnlab/use-wallet/commit/ca3810013a16aac89d4c05f7e3bee6f5dd765344))

### Bug Fixes

- adding method to use cached wallet id if available, otherwise grab it from the kmd ([#40](https://github.com/txnlab/use-wallet/issues/40)) ([b7c0cf2](https://github.com/txnlab/use-wallet/commit/b7c0cf237eeaca53189b6ec6cc02950cc82de5b2))

## [1.1.6](https://github.com/TxnLab/use-wallet/compare/v1.1.5...v1.1.6) (2023-01-16)

### Changes

- Change provider initialization failure from console error to warning.

## [1.1.5](https://github.com/TxnLab/use-wallet/releases/tag/v1.1.5) (2023-01-16)

### Features

- Add `status`, `isReady` and `isActive` properties to check status of the providers.

## [1.0.5](https://github.com/TxnLab/use-wallet/compare/v1.0.4...v1.0.5) (2022-12-29)

### Features

- Add the `indexesToSign` option to `signTransactions` to optionally specify which indexes of the group should be signed.
- Add the `returnGroup` parameter to `signTransactions` to specify if all transactions that were passed should be returned, or just the ones signed by the provider.

### Bug Fixes

- Fix the `signer` method so that it accepts both signed and unsigned transactions.

## [1.0.4](https://github.com/TxnLab/use-wallet/compare/v1.0.3...v1.0.4) (2022-12-15)

### Features

- Enable multiple WalletConnect sessions (e.g., Pera and Defly) to be active at the same time.

### Bug Fixes

- Fix hydration errors that occur with SSR frameworks like Next.js.
- Prevent the providers from being initialized during SSR, as many of them rely on client side globals like `window` and `Audio`.

## [1.0.3](https://github.com/TxnLab/use-wallet/compare/v1.0.2...v1.0.3) (2022-12-13)

### Bug Fixes

- Prevent KMD from prompting password on app mount.
- Fix a bug where default KMD configuration wasn't valid.
- Fix a bug where providers would not disconnect if the session was killed in the wallet app (affected Defly and Pera)

## [1.0.2](https://github.com/txnlab/use-wallet/compare/v1.0.1...v1.0.2) (2022-12-07)

### Features

- remove 'audio hack' for Pera ([8dc3a2d](https://github.com/txnlab/use-wallet/commit/8dc3a2d228edbf12e45ad0465a3c355583b4ac1c))

## [1.0.1](https://github.com/txnlab/use-wallet/compare/v0.1.23...v1.0.1) (2022-12-07)

### Bug Fixes

- decoding unsigned AlgoSigner txn as signed ([#18](https://github.com/txnlab/use-wallet/issues/18)) ([8f892ab](https://github.com/txnlab/use-wallet/commit/8f892abec6828ffe03333c4ed3500c47ed3ac504))

# [1.0.0](https://github.com/txnlab/use-wallet/commit/b0ef449e48e71ee4a0d3f8bc401402c930e62ecc) (2022-12-07)

### Features

- The provider clients are now passed to child components using React Context, allowing for more configuration options.
- Provider clients provide support for both dynamic and static imports, allowing `use-wallet` to be used with frameworks that don't support dynamic imports.

### Breaking Changes

- To setup the `providers`, the `initializeProviders` function should be used, and passed to the `WalletProviders` context provider in the application root.
- The provider ID, name, and icon are now part of the `metadata` property of `providers`.
- Using environment variables to configure the clients is deprecated.

## [0.1.23](https://github.com/TxnLab/use-wallet/commits/v0.1.23) (2022-11-16)

### Features

- Dynamically import wallet provider dependencies and reduce bundle size ([#9](https://github.com/TxnLab/use-wallet/pull/9))
- Use first and last valid rounds to determine how many rounds to wait to confirm transactions ([#13](https://github.com/TxnLab/use-wallet/pull/13))
- Handle signing transactions for multiple connected accounts ([#14](https://github.com/TxnLab/use-wallet/pull/14))
- Upgrade to Zustand v4 ([#11](https://github.com/TxnLab/use-wallet/pull/11))
