---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# Installation

### Requirements

* `algosdk` v3
* Environment with support for dynamic imports (e.g., modern build tools like Vite, Next.js, or Webpack 5+)

### Install Package

Use-wallet is available as a core library and as framework-specific adapters for React, Vue, and SolidJS. Choose the appropriate package for your project's framework.

#### React

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet-react
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet-react
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet-react
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet-react
```
{% endtab %}
{% endtabs %}

#### Vue

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet-vue
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet-vue
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet-vue
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet-vue
```
{% endtab %}
{% endtabs %}

#### SolidJS

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet-solid
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet-solid
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet-solid
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet-solid
```
{% endtab %}
{% endtabs %}

#### Core Library

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet
```
{% endtab %}
{% endtabs %}

### Install Dependencies

Some [supported wallet providers](supported-wallets.md) require additional packages to be installed. You only need to install the packages for wallets that you plan to support in your application.

#### Pera Wallet

{% tabs %}
{% tab title="npm" %}
```bash
npm install @perawallet/connect
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @perawallet/connect
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @perawallet/connect
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @perawallet/connect
```
{% endtab %}
{% endtabs %}

#### Defly Wallet

{% tabs %}
{% tab title="npm" %}
```bash
npm install @blockshake/defly-connect
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @blockshake/defly-connect
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @blockshake/defly-connect
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @blockshake/defly-connect
```
{% endtab %}
{% endtabs %}

#### Defly Wallet (Web)

{% hint style="warning" %}
The Defly Web Wallet is currently in beta.
{% endhint %}

{% tabs %}
{% tab title="npm" %}
```bash
npm install @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @agoralabs-sh/avm-web-provider
```
{% endtab %}
{% endtabs %}

#### WalletConnect

{% tabs %}
{% tab title="npm" %}
```bash
npm install @walletconnect/sign-client @walletconnect/modal
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @walletconnect/sign-client @walletconnect/modal
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @walletconnect/sign-client @walletconnect/modal
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @walletconnect/sign-client @walletconnect/modal
```
{% endtab %}
{% endtabs %}

#### Lute Wallet

{% tabs %}
{% tab title="npm" %}
```bash
npm install lute-connect
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add lute-connect
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add lute-connect
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add lute-connect
```
{% endtab %}
{% endtabs %}

#### Kibisis

{% tabs %}
{% tab title="npm" %}
```bash
npm install @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @agoralabs-sh/avm-web-provider
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @agoralabs-sh/avm-web-provider
```
{% endtab %}
{% endtabs %}

#### Magic Auth

{% tabs %}
{% tab title="npm" %}
```bash
npm install magic-sdk @magic-ext/algorand
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add magic-sdk @magic-ext/algorand
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add magic-sdk @magic-ext/algorand
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add magic-sdk @magic-ext/algorand
```
{% endtab %}
{% endtabs %}

### Webpack Configuration

When using this library in a project that uses Webpack as its build tool, you may encounter "module not found" errors for optional dependencies of wallets you choose not to support. To resolve this, you can use the `webpackFallback` export.

Here's how to configure Webpack to handle these optional dependencies:

```javascript
// webpack.config.js
import { webpackFallback } from '@txnlab/use-wallet' // exported by all packages

export default {
  // ... other webpack configuration
  resolve: {
    fallback: {
      ...webpackFallback
    }
  }
}
```

For Next.js specifically, add this to your `next.config.js`:

```javascript
import { webpackFallback } from '@txnlab/use-wallet-react'

const nextConfig = {
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

This configuration allows your application to build and run without these packages installed, enabling you to include only the wallet packages you need. The `webpackFallback` object is maintained within the `@txnlab/use-wallet` library and will be automatically updated when new optional dependencies are added.
