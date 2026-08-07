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
* ESM-capable environment (modern bundlers like Vite, Next.js, or Webpack 5+)
* Node.js 22 or later (for SSR, tooling, and development — the packages are ESM-only and do not ship a CommonJS build)

### Install Package

Use-wallet is available as a core library and as framework-specific adapters for React, Vue, SolidJS, and Svelte. Choose the appropriate package for your project's framework.

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

#### Svelte

{% tabs %}
{% tab title="npm" %}
```bash
npm install @txnlab/use-wallet-svelte
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @txnlab/use-wallet-svelte
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @txnlab/use-wallet-svelte
```
{% endtab %}

{% tab title="bun" %}
```bash
bun add @txnlab/use-wallet-svelte
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

### Install Wallet Adapters

Each wallet is provided as a separate adapter package. Install only the adapters for the wallets you want to support:

```bash
# Install the adapters for the wallets you want to support
npm install @txnlab/use-wallet-pera @txnlab/use-wallet-defly
```

#### Available Adapter Packages

| Adapter Package | Wallet |
|----------------|--------|
| `@txnlab/use-wallet-pera` | Pera Wallet |
| `@txnlab/use-wallet-defly` | Defly Wallet |
| `@txnlab/use-wallet-exodus` | Exodus |
| `@txnlab/use-wallet-walletconnect` | WalletConnect (+ skins: Biatec, Voi) |
| `@txnlab/use-wallet-kibisis` | Kibisis |
| `@txnlab/use-wallet-lute` | Lute Wallet |
| `@txnlab/use-wallet-w3wallet` | W3 Wallet |
| `@txnlab/use-wallet-kmd` | KMD (development) |
| `@txnlab/use-wallet-mnemonic` | Mnemonic (testing) |
| `@txnlab/use-wallet-web3auth` | Web3Auth |

{% hint style="info" %}
The Custom wallet adapter is built into `@txnlab/use-wallet` — no separate package needed.
{% endhint %}

{% hint style="info" %}
Wallet SDK dependencies (e.g., `@perawallet/connect`) are bundled with each adapter package — you don't need to install them separately.
{% endhint %}
