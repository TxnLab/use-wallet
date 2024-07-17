## [3.0.0-rc.3](https://github.com/txnlab/use-wallet/compare/v3.0.0-rc.2...v3.0.0-rc.3) (2024-07-02)

### Fixes

- Move `algosdk` to peerDependencies ([#193](https://github.com/TxnLab/use-wallet/pull/193)) ([179ba8d](https://github.com/TxnLab/use-wallet/commit/179ba8d5abe112b6444c013ecae042f93b16c8ff))
- Add `algosdk` to devDependencies, sync versions ([#197](https://github.com/TxnLab/use-wallet/pull/197)) ([332f360](https://github.com/TxnLab/use-wallet/commit/332f360eb9307bae286c450a68d3108d0a371b92))
- Switching networks should not disconnect wallets ([#198](https://github.com/TxnLab/use-wallet/pull/198)) ([47e5704](https://github.com/TxnLab/use-wallet/commit/47e5704589e736b788810fdb943e4a81c4346b39))

## [3.0.0-rc.2](https://github.com/txnlab/use-wallet/compare/v3.0.0-rc.1...v3.0.0-rc.2) (2024-06-20)

### Fixes

- **Core:** Fixes `isTransactionArray` utility function ([#190](https://github.com/TxnLab/use-wallet/pull/190)) ([0e119ea](https://github.com/TxnLab/use-wallet/commit/0e119ea22efb50b2a3337291059b51fd2dcb621e))

## [3.0.0-rc.1](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.10...v3.0.0-rc.1) (2024-06-20)

### :warning: BREAKING CHANGES

This release includes breaking changes. Please refer to the [release notes](https://github.com/TxnLab/use-wallet/releases/tag/v3.0.0-rc.1) for upgrade instructions.

### Features

- **Core:** Add Custom provider ([#181](https://github.com/TxnLab/use-wallet/pull/181)) ([bdaf3ee](https://github.com/TxnLab/use-wallet/commit/bdaf3eee5a2359245958be6b11976bf78b9a79a7))
- **Kibisis:** Implement AVM provider with Kibisis client ([#175](https://github.com/TxnLab/use-wallet/pull/175)) ([9a7203d](https://github.com/TxnLab/use-wallet/commit/9a7203d99be510f33fa26b2e527fd7931f5247ec))
- **Core:** Wallet provider updates ([#183](https://github.com/TxnLab/use-wallet/pull/183)) ([1b7720a](https://github.com/TxnLab/use-wallet/commit/1b7720a9af064021d41278505b8cbf5dd31456cf))
- **Core:** Switching networks ([#187](https://github.com/TxnLab/use-wallet/pull/187)) ([ef07c4d](https://github.com/TxnLab/use-wallet/commit/ef07c4df30bf6dfb251b072fe944aeb77e0de8c9))
- **Core:** Revert Pera provider to Pera Connect v1 ([#188](https://github.com/TxnLab/use-wallet/pull/188)) ([4a5c947](https://github.com/TxnLab/use-wallet/commit/4a5c9479760a4ddb365a89d0e26ea472f9881c72))
- **Core:** `signTransactions` response should match length of `txnGroup` ([#189](https://github.com/TxnLab/use-wallet/pull/189)) ([5244482](https://github.com/TxnLab/use-wallet/commit/5244482385bffa10a0ef2e4263f30dba286444a7))

### Fixes

- **WalletConnect:** Handle all response types from `algo_signTxn` ([#185](https://github.com/TxnLab/use-wallet/pull/185)) ([1e246e1](https://github.com/TxnLab/use-wallet/commit/1e246e18352c36ebaff1e478825c2dce6cdde4b1))
- **WalletConnect:** Get default metadata from window ([#186](https://github.com/TxnLab/use-wallet/pull/186)) ([2c1762d](https://github.com/TxnLab/use-wallet/commit/2c1762d49944863884127d4a32a1edc499d33d03))

### Other Changes

- Upgrade to pnpm v9 ([#182](https://github.com/TxnLab/use-wallet/pull/182)) ([a33ad92](https://github.com/TxnLab/use-wallet/commit/a33ad9260c2b52a61b1c1c2ee231426652213c8b))
- Set `@perawallet/connect-beta` to ^2.0.11 ([#184](https://github.com/TxnLab/use-wallet/pull/184)) ([4f2330a](https://github.com/TxnLab/use-wallet/commit/4f2330a1a0eb3b23e8a32fe5cbf0d7264b1235d1))

## [3.0.0-beta.10](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.9...v3.0.0-beta.10) (2024-06-04)

### Features

- **Core:** Add Magic provider ([#180](https://github.com/TxnLab/use-wallet/pull/180)) ([afb981f](https://github.com/TxnLab/use-wallet/commit/afb981f7e5cd0d960ffde9055e9cc9bb65ec86be))

## [3.0.0-beta.9](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.8...v3.0.0-beta.9) (2024-06-01)

### Fixes

- **Core:** Fallbacks for named/default Pera Connect v2 export ([b4ccb40](https://github.com/TxnLab/use-wallet/commit/b4ccb404f063b8cb7835540df6b6541527bf009c))

## [3.0.0-beta.8](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.7...v3.0.0-beta.8) (2024-06-01)

### :warning: BREAKING CHANGES

This release includes breaking changes. Please refer to the [release notes](https://github.com/TxnLab/use-wallet/releases/tag/v3.0.0-beta.8) for upgrade instructions.

### Features

- **Core:** Migrate Pera Wallet provider to Pera Connect v2 ([#179](https://github.com/TxnLab/use-wallet/pull/179)) ([87db889](https://github.com/TxnLab/use-wallet/commit/87db889e9403e8efa01db3ebce3d4f494d4c9280))

## [3.0.0-beta.7](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.6...v3.0.0-beta.7) (2024-05-16)

### Fixes

- **Solid:** Fix transaction signing functions, add signing to example app ([#172](https://github.com/TxnLab/use-wallet/pull/172)) ([097638f](https://github.com/TxnLab/use-wallet/commit/097638f8a73cb0c43979614b356effc5e5019fc3))

### Other Changes

- Update README with SolidJS quick start ([9e2611b](https://github.com/TxnLab/use-wallet/commit/9e2611b17ee042d06e8a62d38af8c6f0d411b6c8))

## [3.0.0-beta.6](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.5...v3.0.0-beta.6) (2024-05-16)

### Features

- Solid.js framework adapter: use-wallet-solid ([#169](https://github.com/TxnLab/use-wallet/pull/169)) ([a5f407b](https://github.com/TxnLab/use-wallet/commit/a5f407b41e1351c4511e84b9da7ecaebbc0b76ce))

### Other Changes

- Update non-major dependencies ([#170](https://github.com/TxnLab/use-wallet/pull/170)) ([7157e24](https://github.com/TxnLab/use-wallet/commit/7157e248110ef6e6e46bd869191a6c5872b48707))

## [3.0.0-beta.5](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.4...v3.0.0-beta.5) (2024-04-11)

### Hotfix

- **Core:** Use correct Localnet algod default port ([#165](https://github.com/txnlab/use-wallet/pull/165)) ([ec1c4bb](https://github.com/txnlab/use-wallet/commit/ec1c4bb4151706bf930121549da12699a22fa714))

## [3.0.0-beta.4](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.3...v3.0.0-beta.4) (2024-04-11)

### Features

- **Core:** Set default LocalNet network config ([#164](https://github.com/txnlab/use-wallet/pull/164)) ([ef65328](https://github.com/txnlab/use-wallet/commit/ef653283897c514705db8339c6413172d4802aa8))

### Bug Fixes

- **Core:** Use correct `this` context in setActiveNetwork ([#163](https://github.com/txnlab/use-wallet/pull/163)) ([b48dd33](https://github.com/txnlab/use-wallet/commit/b48dd33c98092a3165b6e034fd16e9dbd3ae0848))

### Other Changes

- Remove `@walletconnect/utils` dependency (drastically reducing bundle size) ([025d0a9](https://github.com/txnlab/use-wallet/commit/025d0a9face8bd3681354959d4a7271cdd881da3))

## [3.0.0-beta.3](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.2...v3.0.0-beta.3) (2024-04-09)

### Bug Fixes

- **Core:** Perform byte array <-> b64 conversions w/ native JS ([#153](https://github.com/txnlab/use-wallet/pull/153)) ([054947c](https://github.com/txnlab/use-wallet/commit/054947c911a34fb297df9f368f61c252280c49f7))

## [3.0.0-beta.2](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.1...v3.0.0-beta.2) (2024-04-02)

### Bug Fixes

- **Core:** Ensure correct `this` context in public callback methods ([#152](https://github.com/txnlab/use-wallet/pull/152)) ([88e649f](https://github.com/txnlab/use-wallet/commit/88e649f5856af3461b7635cc7c922fa4d5acb63b))

# [3.0.0-beta.1](https://github.com/TxnLab/use-wallet/tree/v3.0.0-beta.1) (2024-03-27)

### Summary

Introduces a complete rewrite of the `use-wallet` library, now structured as a monorepo to support vanilla JavaScript/TypeScript applications alongside framework-specific adapters for React and Vue. Key advancements include:

- Transition to vanilla TypeScript for the core library, ensuring framework-agnostic compatibility.
- Addition of framework-specific adapters, initially for React and Vue, with plans for Solid.js and Svelte.
- Examples for vanilla TS, React, Vue, along with SSR examples for Next.js and Nuxt.
- Modernization of the toolchain, adopting PNPM for package management and Vitest for testing.

This update retains a familiar API design for ease of transition from v2, while significantly expanding the library's functionality and developer experience.

See https://github.com/TxnLab/use-wallet-js for alpha stage development history.
