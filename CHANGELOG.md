# [5.0.0-rc.4](https://github.com/TxnLab/use-wallet/compare/v5.0.0-rc.3...v5.0.0-rc.4) (2026-08-07)


* feat(*)!: remove Defly Web and Magic wallet adapters ([e497193](https://github.com/TxnLab/use-wallet/commit/e4971931926873eabaca48fca5596f3460d2f300))


### Bug Fixes

* harden package manifests for v5 stable ([636d61c](https://github.com/TxnLab/use-wallet/commit/636d61c64c2f9187c60ed7241c0f61fc3f08f3d9))
* **kmd:** only offer KMD wallet on LocalNet ([6c9ca41](https://github.com/TxnLab/use-wallet/commit/6c9ca4110bee212d1e0e8c1f1ef04a41173681ef))
* **pera:** normalize signData errors and align packaging ([#441](https://github.com/TxnLab/use-wallet/issues/441) follow-up) ([c373ddc](https://github.com/TxnLab/use-wallet/commit/c373ddcda31d8c5790fdb23d640afc76a5c976dc))


### Features

* **core:** emit wallet lifecycle and error events ([8f50217](https://github.com/TxnLab/use-wallet/commit/8f50217cbb5f977ba196bc2e15f9819d1a4c1bea))
* support metadata override in adapter factory functions ([08b1071](https://github.com/TxnLab/use-wallet/commit/08b1071fac4961c72f1fe41bff5c4d893dbed724))


### BREAKING CHANGES

* The @txnlab/use-wallet-defly-web and
@txnlab/use-wallet-magic adapter packages have been removed. Magic no
longer supports Algorand; apps using Magic for email-based login can
migrate to @txnlab/use-wallet-web3auth. The mobile Defly adapter
(@txnlab/use-wallet-defly) is unaffected.

# [5.0.0-rc.3](https://github.com/TxnLab/use-wallet/compare/v5.0.0-rc.2...v5.0.0-rc.3) (2026-08-07)


### Features

* add signData to Pera adapter ([#441](https://github.com/TxnLab/use-wallet/issues/441)) ([a61cbeb](https://github.com/TxnLab/use-wallet/commit/a61cbeb2c1e4c190ce13fb430dac6f3a6f734db2))

# [5.0.0-rc.2](https://github.com/TxnLab/use-wallet/compare/v5.0.0-rc.1...v5.0.0-rc.2) (2026-07-24)


### Features

* signData builds StdSignData from a data string internally ([#439](https://github.com/TxnLab/use-wallet/issues/439)) ([3349e94](https://github.com/TxnLab/use-wallet/commit/3349e94f46836cf32ff640ad4fedba01da5af85e))


### BREAKING CHANGES

* signData now takes a plain `data` string and builds the
ARC-60 StdSignData internally (rekey-aware signer, domain, authenticatorData).
The SignData / SignDataResponse / SignMetadata types are renamed to
StdSignData / StdSignDataResponse / StdSignMetadata.

# [5.0.0-rc.1](https://github.com/TxnLab/use-wallet/compare/v4.6.0...v5.0.0-rc.1) (2026-03-08)


### Bug Fixes

* **core:** add setActiveAccount to AdapterStoreAccessor ([232fec9](https://github.com/TxnLab/use-wallet/commit/232fec90c8486fbecd00f1b097e2c9051d29021e))
* **core:** disconnect incompatible wallets on network switch ([dbc708d](https://github.com/TxnLab/use-wallet/commit/dbc708de78e056d77bb0da024d305565bab40cf4))
* **core:** make CustomProvider.connect optional to match runtime behavior ([ab8dddc](https://github.com/TxnLab/use-wallet/commit/ab8dddcb0143031ddc9d825526ffd9506fdc220a))
* **deps:** upgrade @tanstack/store packages for React 19 compatibility ([b114d5b](https://github.com/TxnLab/use-wallet/commit/b114d5b918461149a47211d4f6df79032f8cd570))
* **examples:** fix a11y warnings and missing favicon in Svelte example ([2912691](https://github.com/TxnLab/use-wallet/commit/2912691ff446f5ee36efe48203672a476b873f9b))
* **examples:** suppress Vite version mismatch TS error in Nuxt example ([d41ea32](https://github.com/TxnLab/use-wallet/commit/d41ea324caf03a59bab77b35351fab531d40fd39))
* **solid:** fix reactivity in useWallet hook ([e863110](https://github.com/TxnLab/use-wallet/commit/e8631100d2f0c47c5e941dd99fa58cda81f7c663))
* **solid:** suppress Vite version mismatch TS error in vitest config ([410a88f](https://github.com/TxnLab/use-wallet/commit/410a88fb4238eed2254cd72d5adb2232a5036178))
* **wallets:** fix test import paths after colocation ([341000e](https://github.com/TxnLab/use-wallet/commit/341000e4ab40d4a449b483a80438e699acf4e2b2))
* **wallets:** move wallet SDKs from peerDependencies to dependencies ([9ae0ef5](https://github.com/TxnLab/use-wallet/commit/9ae0ef50a8e82949c55a0c686133575b3ac55d13))


### Features

* **core:** add wallet adapter capabilities ([0bd12bb](https://github.com/TxnLab/use-wallet/commit/0bd12bb827938ee414bedd8f485e6896fd6ed5d9))
* **core:** rename `resetNetwork` to `persistNetwork` ([951511c](https://github.com/TxnLab/use-wallet/commit/951511cd99864ecc0c5272bd4167f2e696858ad2))
* **examples:** rebuild React example for v5 ([7aa2d07](https://github.com/TxnLab/use-wallet/commit/7aa2d0757b77447745e9618b1edc9ca464677926))
* **examples:** rebuild React example with Vite v7 ([e70f4a0](https://github.com/TxnLab/use-wallet/commit/e70f4a030da1aea83c5f5ffcccf54aec618a9c4b))
* **examples:** rebuild remaining examples with Vite v7 ([60f6db3](https://github.com/TxnLab/use-wallet/commit/60f6db3da16c1fd4428c50f74e437a6317d46a6d))
* **examples:** use `availableWallets` for network-filtered wallet lists ([9471d08](https://github.com/TxnLab/use-wallet/commit/9471d087b21931e12bc76fd7fde71ba3b117d785))
* **frameworks:** update framework adapters for v5 ([4f9fcbe](https://github.com/TxnLab/use-wallet/commit/4f9fcbe2af84cdbcf98af8327c8541353acfd4e4))
* **magic:** upgrade Magic SDK from v28 to v33 ([e7d95e5](https://github.com/TxnLab/use-wallet/commit/e7d95e5a7cc4d8c779fb5d52f1de97d54199b67e))
* **pera:** extract wallet adapter package ([974f09e](https://github.com/TxnLab/use-wallet/commit/974f09ec25229373753032d6875b7110b1e4d9aa))
* **wallets:** extract all wallet adapter packages ([6c1c1a8](https://github.com/TxnLab/use-wallet/commit/6c1c1a8ca4db841b12a2716883ad70b433278ff7))
* **web3auth:** upgrade Web3Auth SDK from v9 to v10 ([46b7cee](https://github.com/TxnLab/use-wallet/commit/46b7cee76422d9bea01d0152fc2c8c7a7fe56300))


### BREAKING CHANGES

* **core:** `resetNetwork` option renamed to `persistNetwork` with
inverted default. Apps relying on persisted network must now explicitly
set `persistNetwork: true`.
