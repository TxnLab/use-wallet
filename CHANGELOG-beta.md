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
