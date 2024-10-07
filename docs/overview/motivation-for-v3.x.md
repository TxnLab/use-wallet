---
description: >-
  Learn about the evolution of use-wallet, its transition to a
  framework-agnostic core, and the improvements in v3.x
---

# 💡 Motivation for v3.x

## Background

This library evolved from the first wallet management solution we built for NFDomains, which launched on MainNet in June 2022. Being a Next.js app, the original implementation relied heavily on React primitives. So did the open source version released later that year.

While it was great to see the library being widely adopted in the ecosystem, its dependency on React limited the number of projects (and developers) who could use it.

## Version 3.x

For the new major release, the library has been rebuilt from the ground up. The core library is now written in vanilla TypeScript and is completely framework agnostic. Decoupling the core library from React has allowed us to build adapters for other popular frameworks as well, starting with Vue and Solid.js.

The new version is more lightweight, performant, and easier to develop/debug. New features and improvements include:

* **Switching networks:** Easily switch between different networks (e.g., MainNet, TestNet, LocalNet) on the fly.
* **Modern tooling:** We've switched to PNPM for package management and Vitest for testing, making it easier to manage dependencies and run tests.
* **Test coverage:** We've significantly increased test coverage to ensure the library is robust and reliable.
* **Examples:** The monorepo includes [demo apps](https://github.com/TxnLab/use-wallet/tree/main/examples) for vanilla TypeScript, React, Vue, and Solid, as well as server-side rendering examples for Next.js and Nuxt.js.

We believe these changes will make the library more accessible and useful to a wider range of developers, and we're excited to see how the community will use it in their projects.

## Migration Guide

For developers currently using version 2.x of the library, we've prepared a comprehensive migration guide to help you transition to the new version. This guide covers all the major changes and provides step-by-step instructions for updating your codebase:

{% content-ref url="../guides/migrating-from-v2.x.md" %}
[migrating-from-v2.x.md](../guides/migrating-from-v2.x.md)
{% endcontent-ref %}
