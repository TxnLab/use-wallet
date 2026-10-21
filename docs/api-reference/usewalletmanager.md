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

# useWalletManager

The `useWalletManager` hook/composable returns the [WalletManager](walletmanager.md) instance from the framework adapter's context, for APIs that `useWallet` and `useNetwork` don't expose.

```typescript
useWalletManager(): WalletManager
```

### When to Use It

The wallets returned by `useWallet` are plain objects with a common set of properties and methods. To reach a method or property that only one adapter has, get the adapter instance from the manager with `getWallet(walletKey)` and cast it to the adapter's type. `getWallet` returns `undefined` if no wallet with that key is configured.

`useWalletManager` is also how you reach other WalletManager methods, such as [event handlers](walletmanager.md#events).

The manager itself isn't reactive. Use [useWallet](usewallet.md) and [useNetwork](usenetwork.md) for state your UI renders.

### Framework-Specific Usage

Call `useWalletManager` where the framework allows context access (a component body, `setup`, or a Svelte component's `<script>`), then use the manager anywhere, including event handlers. The examples below call a hypothetical `customMethod()` on a `MyWalletAdapter`.

{% tabs %}
{% tab title="React" %}
```tsx
import { useWalletManager } from '@txnlab/use-wallet-react'
import type { MyWalletAdapter } from 'my-wallet-adapter'

function CustomAction() {
  const manager = useWalletManager()

  const handleClick = async () => {
    const wallet = manager.getWallet('my-wallet') as MyWalletAdapter | undefined
    await wallet?.customMethod()
  }

  return <button onClick={handleClick}>Run</button>
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
<script setup lang="ts">
  import { useWalletManager } from '@txnlab/use-wallet-vue'
  import type { MyWalletAdapter } from 'my-wallet-adapter'

  const manager = useWalletManager()

  const handleClick = async () => {
    const wallet = manager.getWallet('my-wallet') as MyWalletAdapter | undefined
    await wallet?.customMethod()
  }
</script>

<template>
  <button @click="handleClick">Run</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWalletManager } from '@txnlab/use-wallet-solid'
import type { MyWalletAdapter } from 'my-wallet-adapter'

function CustomAction() {
  const manager = useWalletManager()

  const handleClick = async () => {
    const wallet = manager.getWallet('my-wallet') as MyWalletAdapter | undefined
    await wallet?.customMethod()
  }

  return <button onClick={handleClick}>Run</button>
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
<script lang="ts">
  import { useWalletManager } from '@txnlab/use-wallet-svelte'
  import type { MyWalletAdapter } from 'my-wallet-adapter'

  const manager = useWalletManager()

  const handleClick = async () => {
    const wallet = manager.getWallet('my-wallet') as MyWalletAdapter | undefined
    await wallet?.customMethod()
  }
</script>

<button onclick={handleClick}>Run</button>
```
{% endtab %}
{% endtabs %}

### Error Handling

`useWalletManager` throws if there's no manager to return: outside the `WalletProvider` (React, Solid), without the `WalletManagerPlugin` installed (Vue), or outside the context set by `useWalletContext` (Svelte).

### See Also

* [WalletManager](walletmanager.md) - Properties, methods and events of the returned instance
* [useWallet](usewallet.md) - Reactive wallet state and signing methods
* [React](../framework/react.md), [Vue](../framework/vue.md), [SolidJS](../framework/solidjs.md), [Svelte](../framework/svelte.md) - Detailed setup guides
