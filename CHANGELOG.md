# [3.7.0](https://github.com/txnlab/use-wallet/compare/v3.6.1...v3.7.0) (2024-09-27)

### Features

- **Wallets:** Add WalletConnect v1 session management ([#275](https://github.com/txnlab/use-wallet/pull/275)) ([484b2b5](https://github.com/txnlab/use-wallet/commit/484b2b59e53ce187b40ed5d285dcc2577d4be55e))

## [3.6.1](https://github.com/txnlab/use-wallet/compare/v3.6.0...v3.6.1) (2024-09-25)

### Test Updates

- **Lute:** Update mocking for lute-connect v1.4.1 compatibility ([#273](https://github.com/txnlab/use-wallet/pull/273)) ([77f1a37](https://github.com/txnlab/use-wallet/commit/77f1a373b0640657fd41c3b80d06f9881cd81341))

# [3.6.0](https://github.com/txnlab/use-wallet/compare/v3.5.0...v3.6.0) (2024-09-24)

### Features

- **Networks:** Add voimain, aramidmain, fix caip10 fnet ([#267](https://github.com/txnlab/use-wallet/pull/267)) ([fa55713](https://github.com/txnlab/use-wallet/commit/fa5571345ba2cf84ba5bd1c96558641181e6b4a7))
- **Wallets:** Add Biatec Wallet ([#255](https://github.com/txnlab/use-wallet/pull/255)) ([c1e8849](https://github.com/txnlab/use-wallet/commit/c1e8849aef424a95a0e52b97da6f9a239f3fcafe))

### Bug Fixes

- **Wallets:** Correct disconnect handling for Pera and Defly ([#272](https://github.com/txnlab/use-wallet/pull/272)) ([caa7f48](https://github.com/txnlab/use-wallet/commit/caa7f48b326961bce8ce3a026929f2950ce9e000))

# [3.5.0](https://github.com/txnlab/use-wallet/compare/v3.4.0...v3.5.0) (2024-09-18)

### Features

- Implement configurable logging system ([#264](https://github.com/txnlab/use-wallet/pull/264)) ([4912e4e](https://github.com/txnlab/use-wallet/commit/4912e4ee9c601d57ea8c19fbce37aadb48fa8ae9))

### Bug Fixes

- Correct DEBUG log level handling in WalletManager ([#265](https://github.com/txnlab/use-wallet/pull/265)) ([53057b5](https://github.com/txnlab/use-wallet/commit/53057b545799f0041865d919a29c5940ffe9cf79))

# [3.4.0](https://github.com/txnlab/use-wallet/compare/v3.3.0...v3.4.0) (2024-09-13)

### Features

- Add resetNetwork option to WalletManager ([#260](https://github.com/txnlab/use-wallet/pull/260)) ([70b8454](https://github.com/txnlab/use-wallet/commit/70b84549e12a589e8c9bc7632a4f9e1a07b14653))

### Bug Fixes

- Fix Kibisis init in Vue app ([#225](https://github.com/txnlab/use-wallet/pull/225)) ([470171f](https://github.com/txnlab/use-wallet/commit/470171f04f55d44a4d67f9965c1836febbc2dba3))

# [3.3.0](https://github.com/txnlab/use-wallet/compare/v3.2.1...v3.3.0) (2024-09-11)

### Features

- Add fnet to list of valid networks and update nodely urls to new versions ([#258](https://github.com/txnlab/use-wallet/pull/258)) ([07e7273](https://github.com/txnlab/use-wallet/commit/8743101180b730b5fc809951b85df0c8e6c25f8c))
- Update algosdk import to resolve CommonJS module issue ([#259](https://github.com/txnlab/use-wallet/pull/259)) ([8743101](https://github.com/txnlab/use-wallet/commit/daf738af4b67f9178b72cf1728a08b476fd34fcc))

## [3.2.1](https://github.com/txnlab/use-wallet/compare/v3.2.0...v3.2.1) (2024-09-05)

### Other Changes

- Update Renovate configuration to no longer ignore `examples/**` projects' dependencies
- Update all dependencies to latest versions, including `algosdk` (v2.9.0), `@tanstack/store` (v0.5.5), and `typescript` (v5.5.4)
- Improve dev/build process with new development scripts ([#253](https://github.com/txnlab/use-wallet/pull/253)) ([0c9f976](https://github.com/txnlab/use-wallet/commit/0c9f9762d6086045eed1e721dedab9dadffbe6bc))
- Add CONTRIBUTING.md with contribution guidelines ([#254](https://github.com/txnlab/use-wallet/pull/254)) ([91ebc0b](https://github.com/txnlab/use-wallet/commit/91ebc0bc2baf79cc0d6996b94515ffa0cb3f32ce))

# [3.2.0](https://github.com/txnlab/use-wallet/compare/v3.1.6...v3.2.0) (2024-09-03)

### Features

- **Core:** Move algod client to store ([#224](https://github.com/txnlab/use-wallet/pull/224)) ([07e7273](https://github.com/txnlab/use-wallet/commit/07e7273452ab49a54353c4d686b6b7dd4dddfac8))

## [3.1.6](https://github.com/txnlab/use-wallet/compare/v3.1.5...v3.1.6) (2024-08-29)

### Bug Fixes

- **Core:** Initialize manager with active network from persisted state ([#221](https://github.com/txnlab/use-wallet/pull/221)) ([2ff796b](https://github.com/txnlab/use-wallet/commit/2ff796b74c1e16927ce3739ff5980ef655c4e08a))

## [3.1.5](https://github.com/txnlab/use-wallet/compare/v3.1.4...v3.1.5) (2024-08-21)

### Bug Fixes

- **Core:** Immutable state updates in store mutation functions ([#220](https://github.com/txnlab/use-wallet/pull/220)) ([22421d4](https://github.com/txnlab/use-wallet/commit/22421d4951454bf62357d8872942b5dca933b958))

## [3.1.4](https://github.com/txnlab/use-wallet/compare/v3.1.3...v3.1.4) (2024-08-19)

### Bug Fixes

- **WalletConnect:** Handle untyped byte arrays returned by sign request ([#218](https://github.com/txnlab/use-wallet/pull/218)) ([9a39164](https://github.com/txnlab/use-wallet/commit/9a39164c5e58fa2673f52297f04ab72180c53b51))

## [3.1.3](https://github.com/txnlab/use-wallet/compare/v3.1.2...v3.1.3) (2024-08-10)

### Bug Fixes

- **Next.js Example:** Resolve Webpack "module not found" errors ([#212](https://github.com/txnlab/use-wallet/pull/212)) ([b0eea4d](https://github.com/txnlab/use-wallet/commit/b0eea4d89732e462e58e559a5a1f064932a77d10))

## [3.1.2](https://github.com/txnlab/use-wallet/compare/v3.1.1...v3.1.2) (2024-08-09)

### Bug Fixes

- Revert "fix(core): fix Webpack static analysis issue with dynamic imports ([#211](https://github.com/txnlab/use-wallet/pull/211))" ([fc1529b](https://github.com/txnlab/use-wallet/commit/fc1529bc49edd1b70d13a57084000eeddbf00460))

## [3.1.1](https://github.com/txnlab/use-wallet/compare/v3.1.0...v3.1.1) (2024-08-09)

### Bug Fixes

- **Core:** Fix Webpack static analysis issue with dynamic imports ([#211](https://github.com/txnlab/use-wallet/pull/211)) ([4f77fc3](https://github.com/txnlab/use-wallet/commit/4f77fc3c8f3ece643f3b9fcf68ab39804a7cc5fb))

# [3.1.0](https://github.com/txnlab/use-wallet/compare/v3.0.0...v3.1.0) (2024-08-02)

### Features

- Reactive algodClient for SolidJS ([#204](https://github.com/txnlab/use-wallet/pull/204)) ([11ef688](https://github.com/txnlab/use-wallet/commit/11ef688efa724aa94e99232d60c55b2e2a9d41c8))

# [3.0.0](https://github.com/TxnLab/use-wallet/releases/tag/v3.0.0) (2024-07-17)

### Summary

Version 3.0.0 introduces a complete rewrite of the `use-wallet` library, now structured as a monorepo to support vanilla JavaScript/TypeScript applications with reactive framework-specific adapters. This major release focuses on improving flexibility, performance, and developer experience.

### Key Features

- **Framework-Agnostic Core:** Rewritten in vanilla TypeScript for broader compatibility.
- **Framework Adapters:** Initial support for React, Vue, and Solid.js with adapters for Angular and Svelte planned.
- **Enhanced Performance:** More lightweight and easier to debug.
- **Expanded Examples:** Includes demo apps for vanilla TypeScript, React, Vue, Solid.js, and server-side rendering examples for Next.js and Nuxt.
- **Improved Tooling:** Adoption of PNPM for package management and Vitest for testing.
- **Network Switching:** Easy switching between different networks (MainNet, TestNet, LocalNet).
- **Increased Test Coverage:** Ensuring robustness and reliability.

### Breaking Changes

This version includes significant API changes. Please refer to the [Migration Guide](https://txnlab.gitbook.io/use-wallet/guides/migrating-from-v2.x) for detailed upgrade instructions.

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

## [2.8.2](https://github.com/txnlab/use-wallet/compare/v2.8.1...v2.8.2) (2024-05-15)

### Bug Fixes

- **Lute:** Fix signedTxns reconstruction ([#168](https://github.com/txnlab/use-wallet/pull/168)) ([fd85530](https://github.com/txnlab/use-wallet/commit/fd855305dd230860545ca36bb72b7cd64c062c94))

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

## [2.8.1](https://github.com/txnlab/use-wallet/compare/v2.8.0...v2.8.1) (2024-04-09)

### Bug Fixes

- Perform byte array <-> b64 conversions w/ native JS (v2) ([#155](https://github.com/txnlab/use-wallet/pull/155)) ([8f0e354](https://github.com/txnlab/use-wallet/commit/8f0e35475014db87e560391a6f70640b0e33daf0))

## [3.0.0-beta.3](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.2...v3.0.0-beta.3) (2024-04-09)

### Bug Fixes

- **Core:** Perform byte array <-> b64 conversions w/ native JS ([#153](https://github.com/txnlab/use-wallet/pull/153)) ([054947c](https://github.com/txnlab/use-wallet/commit/054947c911a34fb297df9f368f61c252280c49f7))

## [3.0.0-beta.2](https://github.com/txnlab/use-wallet/compare/v3.0.0-beta.1...v3.0.0-beta.2) (2024-04-02)

### Bug Fixes

- **Core:** Ensure correct `this` context in public callback methods ([#152](https://github.com/txnlab/use-wallet/pull/152)) ([88e649f](https://github.com/txnlab/use-wallet/commit/88e649f5856af3461b7635cc7c922fa4d5acb63b))

## [3.0.0-beta.1](https://github.com/TxnLab/use-wallet/tree/v3.0.0-beta.1) (2024-03-27)

### Summary

Introduces a complete rewrite of the `use-wallet` library, now structured as a monorepo to support vanilla JavaScript/TypeScript applications alongside framework-specific adapters for React and Vue. Key advancements include:

- Transition to vanilla TypeScript for the core library, ensuring framework-agnostic compatibility.
- Addition of framework-specific adapters, initially for React and Vue, with plans for Solid.js and Svelte.
- Examples for vanilla TS, React, Vue, along with SSR examples for Next.js and Nuxt.
- Modernization of the toolchain, adopting PNPM for package management and Vitest for testing.

This update retains a familiar API design for ease of transition from v2, while significantly expanding the library's functionality and developer experience.

See https://github.com/TxnLab/use-wallet-js for alpha stage development history.

# [2.8.0](https://github.com/txnlab/use-wallet/compare/v2.7.0...v2.8.0) (2024-03-27)

### Bug Fixes

- Allow any connected account to be set active ([#141](https://github.com/txnlab/use-wallet/pull/141)) ([6220ed3](https://github.com/txnlab/use-wallet/commit/6220ed3f674de903b8e1d84c8e96f9ef342b4d34))
- **Lute:** Fix ESLint error in LuteClient ([802d297](https://github.com/txnlab/use-wallet/commit/802d2972d4585f6ebf0e7bcfcf9180a9b28f56db))
- Wrap postMessage in timeout to prevent race conditions ([#143](https://github.com/txnlab/use-wallet/pull/143)) ([2d18482](https://github.com/txnlab/use-wallet/commit/2d18482ef2dec3c250e9d2987479ca3c994d0825))

### Features

- Add ability to throw connection errors ([#142](https://github.com/txnlab/use-wallet/pull/142)) ([53689eb](https://github.com/txnlab/use-wallet/commit/53689eb2ad4bdbcca9c495749cb0bcd1ff96f636))

# [2.7.0](https://github.com/txnlab/use-wallet/compare/v2.6.2...v2.7.0) (2024-02-06)

### Features

- **Lute:** New Lute icon, util function to convert SVG to Base64 ([#137](https://github.com/txnlab/use-wallet/pull/137)) ([b9b45f9](https://github.com/txnlab/use-wallet/commit/b9b45f958f34e162206f4fcc7414045121269f16))

### Bug Fixes

- **Kibisis:** Replace global object with window ([#139](https://github.com/txnlab/use-wallet/pull/139)) ([e686564](https://github.com/txnlab/use-wallet/commit/e686564f09e166fef9b21fdec117884934d7383a))

## [2.6.2](https://github.com/txnlab/use-wallet/compare/v2.6.1...v2.6.2) (2024-01-31)

### Bug Fixes

- **Magic:** Magic Algorand extension should be provided by consuming application ([#136](https://github.com/txnlab/use-wallet/pull/136)) ([a5ee9af](https://github.com/txnlab/use-wallet/commit/a5ee9af9173b30fb897b12387fecd6d9acbe435a)), closes [#135](https://github.com/txnlab/use-wallet/issues/135)

## [2.6.1](https://github.com/txnlab/use-wallet/compare/v2.6.0...v2.6.1) (2024-01-30)

### Bug Fixes

- Fix package.json typo in peerDependenciesMeta (magic-sdk as optional) ([4c139d9](https://github.com/txnlab/use-wallet/commit/4c139d9696ec335f074423faf5b5cf248e937d28))

# [2.6.0](https://github.com/txnlab/use-wallet/compare/v2.5.0...v2.6.0) (2024-01-30)

### Features

- Magic.link provider (email based authentication) ([#124](https://github.com/txnlab/use-wallet/pull/124)) ([85f8bef](https://github.com/txnlab/use-wallet/commit/85f8befb535a47386d77a4bd14dfcb891809fd01))

### Bug Fixes

- **Kibisis:** Lower `getProvider` timeout from 3 seconds to 0.75 seconds ([#133](https://github.com/txnlab/use-wallet/pull/133)) ([fadf667](https://github.com/txnlab/use-wallet/commit/fadf667d743580715f9c08664cf53a806fb5d9aa))
- **Kibisis:** Remove native web Crypto API dependency when generating UUID ([#134](https://github.com/txnlab/use-wallet/pull/134)) ([54b43e8](https://github.com/txnlab/use-wallet/commit/54b43e81efe8f57b6c706e30fea3d5579727a1e6))

# [2.5.0](https://github.com/txnlab/use-wallet/compare/v2.4.0...v2.5.0) (2024-01-25)

### Features

- Kibisis provider ([#128](https://github.com/txnlab/use-wallet/pull/128)) ([279e49a](https://github.com/txnlab/use-wallet/commit/279e49a107a855c7f010ce16121df22421ca83cf))

# [2.4.0](https://github.com/txnlab/use-wallet/compare/v2.3.1...v2.4.0) (2024-01-17)

### Features

- Lute Wallet provider ([#129](https://github.com/txnlab/use-wallet/pull/129)) ([e71503b](https://github.com/txnlab/use-wallet/commit/e71503b65e7a3bf1034965f3f8a6fb8fb993099f))

## [2.3.1](https://github.com/txnlab/use-wallet/compare/v2.3.0...v2.3.1) (2023-12-15)

### Changes

- Throw error if `useWallet` hook is being used outside the `WalletProvider` ([#125](https://github.com/txnlab/use-wallet/pull/125)) ([3ccc5e0](https://github.com/txnlab/use-wallet/commit/3ccc5e0251ff3f4f5f0da5950a038d8d1f21e70c))
- Use named export of `zustand/shallow` to suppress deprecation warning ([263a56b](https://github.com/TxnLab/use-wallet/commit/263a56b95e9cab6112cc0f46f456ddbc107e7ee7))

# [2.3.0](https://github.com/txnlab/use-wallet/compare/v2.2.0...v2.3.0) (2023-11-29)

### Features

- Support rekeyed signing with kmd ([#121](https://github.com/txnlab/use-wallet/pull/121)) ([e09b7b5](https://github.com/txnlab/use-wallet/commit/e09b7b545616f889df1a6276b5ede1d255d0b47b))

# [2.2.0](https://github.com/txnlab/use-wallet/compare/v2.1.3...v2.2.0) (2023-10-11)

### Features

- Custom wallet ([#106](https://github.com/txnlab/use-wallet/pull/106)) ([f1bb0f1](https://github.com/txnlab/use-wallet/commit/f1bb0f15177e7f719a9ec454ea847899837ee614))

## [2.1.3](https://github.com/txnlab/use-wallet/compare/v2.1.2...v2.1.3) (2023-09-22)

### Bug Fixes

- preserve order of providers as passed into `useInitializeProviders` ([#111](https://github.com/txnlab/use-wallet/pull/111)) ([35a6333](https://github.com/txnlab/use-wallet/commit/35a6333d53877d62609a90212f0948289b1a2cfc)), closes [#104](https://github.com/txnlab/use-wallet/issues/104)

## [2.1.2](https://github.com/txnlab/use-wallet/compare/v2.1.1...v2.1.2) (2023-09-12)

### Changes

- Update documentation to show recommended approach for node configuration ([#110](https://github.com/TxnLab/use-wallet/pull/110)) ([b50c564](https://github.com/TxnLab/use-wallet/commit/b50c564d8ef6e6fb8c207848737851b4f3b8d64d))

## [2.1.1](https://github.com/txnlab/use-wallet/compare/v2.1.0...v2.1.1) (2023-08-11)

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
