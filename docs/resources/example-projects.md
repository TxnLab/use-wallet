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

# Example Projects

This page provides an overview of the example projects available in the use-wallet repository. Each example demonstrates key features and best practices for integrating use-wallet into different frameworks and environments.

All examples are built with Vite or their respective meta-frameworks and include:

* Complete wallet integration with all supported providers
* Transaction signing demonstration
* End-to-end tests with Playwright
* TypeScript configuration
* Runtime node configuration UI (Vite examples only)

### Framework Examples

#### **Vite (React)**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/react-ts
pnpm install
pnpm dev
```

The React example demonstrates:

* React-specific hooks and patterns
* Component composition with TypeScript
* Integration with React's state management
* Advanced features like runtime node configuration

#### **Vite (Vue)**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/vue-ts
pnpm install
pnpm dev
```

The Vue example showcases:

* Vue composables and plugins
* Integration with Vue's reactivity system
* TypeScript support in Vue components
* Advanced features like runtime node configuration

#### **Vite (SolidJS)**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/solid-ts
pnpm install
pnpm dev
```

The Solid example illustrates:

* Solid.js primitives and patterns
* Fine-grained reactivity integration
* TypeScript configuration for Solid
* Advanced features like runtime node configuration

#### **Vite (Vanilla TypeScript)**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/vanilla-ts
pnpm install
pnpm dev
```

The Vanilla TypeScript example demonstrates:

* Framework-agnostic usage
* Direct WalletManager implementation
* Custom state management
* TypeScript configuration without a framework

### Meta-Framework Examples

#### **Next.js**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/nextjs
pnpm install
pnpm dev
```

The Next.js example demonstrates:

* Server-side rendering considerations
* Next.js-specific configuration
* Integration with Next.js App Router
* TypeScript configuration for Next.js

#### **Nuxt**

```bash
git clone https://github.com/TxnLab/use-wallet
cd use-wallet/examples/nuxt
pnpm install
pnpm dev
```

The Nuxt example showcases:

* Server-side rendering with Vue
* Nuxt module integration
* Auto-imports configuration
* TypeScript configuration for Nuxt

### Key Features

#### Wallet Integration

All examples include a complete wallet connection interface demonstrating:

* Connecting/disconnecting wallets
* Switching active accounts
* Transaction signing
* Network management

#### Runtime Node Configuration

The Vite examples include a UI for configuring Algorand node settings at runtime:

* Custom node URL/port/headers
* Network switching
* Configuration persistence

For more information about this feature, see the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide.

#### Testing

All examples include end-to-end tests using Playwright, demonstrating:

* Mocked Algorand node responses
* Wallet connection testing
* Transaction signing tests
* Network switching tests

For more information about testing, see the [Testing with Mnemonic Wallet](../guides/testing-with-mnemonic-wallet.md) guide.

### Getting Started

1. Clone the repository:

```bash
git clone https://github.com/TxnLab/use-wallet
```

2. Install dependencies:

```bash
cd use-wallet
pnpm install
```

3. Build the packages:

```bash
pnpm build
```

4. Run an example using the provided scripts:

```bash
pnpm example:react   # Run React example
pnpm example:vue     # Run Vue example
pnpm example:solid   # Run Solid example
pnpm example:ts      # Run Vanilla TypeScript example
pnpm example:nextjs  # Run Next.js example
pnpm example:nuxt    # Run Nuxt example
```

### Next Steps

* Read the [framework-specific integration](broken-reference) guides for detailed setup instructions
* Explore the [Connect Wallet Menu](../guides/connect-wallet-menu.md) guide to understand core wallet integration concepts and best practices
* Learn about advanced features in the [Runtime Node Configuration](../guides/runtime-node-configuration.md) guide
* Set up testing with the [Testing with Mnemonic Wallet](../guides/testing-with-mnemonic-wallet.md) guide
