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

<table><thead><tr><th width="220">Wallet Provider</th><th>Package(s)</th></tr></thead><tbody><tr><td>Defly Wallet</td><td><code>@blockshake/defly-connect</code></td></tr><tr><td>Pera Wallet</td><td><code>@perawallet/connect</code></td></tr><tr><td>WalletConnect</td><td><code>@walletconnect/sign-client</code>, <code>@walletconnect/modal</code></td></tr><tr><td>Lute Wallet</td><td><code>lute-connect</code></td></tr><tr><td>Magic</td><td><code>magic-sdk</code>, <code>@magic-ext/algorand</code></td></tr><tr><td>Kibisis</td><td><code>@agoralabs-sh/avm-web-provider</code></td></tr></tbody></table>

## Webpack config for Next.js

When using `@txnlab/use-wallet-react` in a Next.js application, you may encounter "module not found" errors for optional dependencies of wallets you choose not to support. To resolve this, you can use the [`webpackFallback`](https://github.com/TxnLab/use-wallet/blob/main/packages/use-wallet/src/webpack.ts) export (added in [v3.10.0](https://github.com/TxnLab/use-wallet/releases/tag/v3.10.0))

{% tabs %}
{% tab title="next.config.ts" %}
```typescript
import type { NextConfig } from 'next'
import { webpackFallback } from '@txnlab/use-wallet-react'
 
const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...webpackFallback
      }
    }
    return config
  }
}
 
export default nextConfig
```
{% endtab %}

{% tab title="next.config.mjs" %}
```javascript
// @ts-check
 
import { webpackFallback } from '@txnlab/use-wallet-react'

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...webpackFallback
      }
    }
    return config
  }
}
 
export default nextConfig
```
{% endtab %}

{% tab title="next.config.js" %}
```javascript
// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ...require('@txnlab/use-wallet-react').webpackFallback
      }
    }
    return config
  }
}

module.exports = nextConfig
```
{% endtab %}
{% endtabs %}

This configuration allows your Next.js app to build and run without these packages installed, enabling you to include only the wallet packages you need. The `webpackFallback` object is maintained within the `@txnlab/use-wallet` library and will be automatically updated when new optional dependencies are added.
