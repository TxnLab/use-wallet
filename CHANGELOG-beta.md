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