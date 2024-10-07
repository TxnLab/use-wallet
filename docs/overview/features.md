---
description: >-
  Discover the key capabilities of use-wallet, from flexible wallet support to
  framework-agnostic design, simplifying Algorand dApp development
---

# ✨ Features

## Summary

Wallet providers come in many forms: mobile apps, web-based, browser extensions, etc., each with their own unique API.

Use-wallet serves as an abstraction layer over these APIs, offering developers a simplified, consistent interface for wallet interactions and management.

## Supported Wallets

All major wallets in the Algorand ecosystem are supported, and the library is regularly updated to include new wallets as they become available.

{% content-ref url="../fundamentals/supported-wallets.md" %}
[supported-wallets.md](../fundamentals/supported-wallets.md)
{% endcontent-ref %}

## Key Features

1. **Flexible Wallet Support**: Easily select and configure which wallets to support in your application.
2. **Headless UI Integration**: The library is unopinionated about UI; build wallet selection menus and connection interfaces however you like.
3. **Global State Management**: Read and write persistent wallet-related state globally across your application.
4. **Universal Transaction Signing**: Access the wallet manager to sign transactions from anywhere in your application.
5. **Framework Agnostic**: Core library works with any JavaScript framework, with specific adapters for popular frameworks like React, Vue, and Solid.js.
6. **TypeScript Support**: Full TypeScript support for improved developer experience and type safety.

These features combine to significantly reduce the complexity of wallet integration in Algorand dApps, allowing developers to focus on core application logic rather than rolling their own wallet management solution from scratch.
