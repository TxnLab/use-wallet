---
description: A quick guide to set up use-wallet in your project
---

# 🛠️ Get Started

## Prerequisites

* Node.js v18+ (v20 recommended) or Bun
* NPM, PNPM, Yarn or Bun
* `algosdk` (v2.7.0+)
* Environment with support for dynamic imports (e.g., modern build tools like Vite, Next.js, or Webpack 5+)

{% hint style="warning" %}
**Important:** This library uses dynamic imports to load wallet-specific dependencies only when they are needed. Ensure your project's build setup supports dynamic imports.

The library is not compatible with Create React App (CRA) projects due to CRA's lack of full support for dynamic imports. As CRA is deprecated, we recommend using more modern tooling for new projects.

We are aware that some modern frameworks, such as Remix, also do not fully support dynamic imports. While v3.0.0 does not include a workaround for this, we plan to reintroduce support for static imports in a future release.
{% endhint %}

## Install dependencies

### Algorand JS SDK

The `algosdk` package must be installed in your project as a peer dependency. Use your preferred package manager to install it.

```bash
npm install algosdk
```

Next, install one of the framework adapters or the standalone core library:

### React

```bash
npm install @txnlab/use-wallet-react
```

### Vue

```bash
npm install @txnlab/use-wallet-vue
```

### Solid.js

```bash
npm install @txnlab/use-wallet-solid
```

### Core Library

```bash
npm install @txnlab/use-wallet
```

## Wallet-specific dependencies

Some wallets require additional packages to be installed. The following table lists wallet providers and their corresponding packages.

| Wallet Provider | Package(s)                                           |
| --------------- | ---------------------------------------------------- |
| Defly Wallet    | `@blockshake/defly-connect`                          |
| Pera Wallet     | `@perawallet/connect`                                |
| WalletConnect   | `@walletconnect/sign-client`, `@walletconnect/modal` |
| Lute Wallet     | `lute-connect`                                       |
| Magic           | `magic-sdk`, `@magic-ext/algorand`                   |
| Kibisis         | `@agoralabs-sh/avm-web-provider`                     |
