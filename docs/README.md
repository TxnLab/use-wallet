---
description: Easily integrate Algorand wallets in your dApps
---

# Overview

Use-wallet is a comprehensive wallet management solution for Algorand/AVM dApps. It reduces the complexity of wallet integrations, letting developers focus on core application logic.

The library is framework-agnostic and can be used in any modern front-end stack, with official adapters for [React](framework/react.md), [Vue](framework/vue.md), and [SolidJS](framework/solidjs.md), and [Svelte](framework/svelte.md).

Version 5.x introduces several major improvements:

* **Modular Wallet Adapters** — Install only the wallets you need as separate packages
* **Factory Function Configuration** — Type-safe wallet setup with per-adapter autocomplete
* **Tree-Shakeable** — Unused wallet code is eliminated from bundles
* **Wallet Capabilities** — Network-aware wallet filtering with `availableWallets`
* **ESM-Only** — Modern ES module output for all packages

See the [Migration Guide](guides/migrating-from-v4.x.md) for help upgrading from v4.x.

{% hint style="info" %}
**Looking for v4 docs?** You can find the use-wallet v4.x documentation [here](https://txnlab.gitbook.io/use-wallet/v4).
{% endhint %}

### Links

* [GitHub Repository](https://github.com/TxnLab/use-wallet)
* [Discord Support Channel](https://discord.gg/YkfksmJRrd) (#use-wallet on NFDomains Discord)

{% embed url="https://www.youtube.com/watch?v=DdvrcBdnRCI" %}
Awesome Algorand #22 - Doug Richar: How 'use-wallet' transformed Algorand wallet management
{% endembed %}
