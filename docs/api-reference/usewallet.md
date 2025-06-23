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

# useWallet

The `useWallet` adapter provides reactive access to wallet state and methods from the WalletManager. It's available for React, Vue, SolidJS, and Svelte, offering a consistent API across frameworks while respecting each framework's patterns and conventions.

{% tabs %}
{% tab title="React" %}
```tsx
import { useNetwork, useWallet } from '@txnlab/use-wallet-react'

function WalletStatus() {
  const { activeAccount } = useWallet()
  const { activeNetwork } = useNetwork()

  if (!activeAccount) {
    return <div>No wallet connected</div>
  }

  return (
    <div>
      <div>Account: {activeAccount.name}</div>
      <div>Network: {activeNetwork}</div>
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup>
  import { useNetwork, useWallet } from '@txnlab/use-wallet-vue'

  const { activeAccount } = useWallet()
  const { activeNetwork } = useNetwork()
</script>

<template>
  <div v-if="!activeAccount">
    No wallet connected
  </div>
  <div v-else>
    <div>Account: {{ activeAccount.name }}</div>
    <div>Network: {{ activeNetwork }}</div>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useNetwork, useWallet } from '@txnlab/use-wallet-solid'

function WalletStatus() {
  const { activeAccount } = useWallet()
  const { activeNetwork } = useNetwork()

  return (
    <Show when={activeAccount()} fallback={<div>No wallet connected</div>}>
      <div>
        <div>Account: {activeAccount()?.name}</div>
        <div>Network: {activeNetwork()}</div>
      </div>
    </Show>
  )
}
```
{% endtab %}
{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useNetwork, useWallet } from '@txnlab/use-wallet-svelte'
  const { activeAccount } = useWallet()
  const { activeNetwork } = useNetwork()
</script>

{#if !activeAccount.current}
  <div>No wallet connected</div>
{:else}
  <div>
    <div>Account: {activeAccount.current.name}</div>
    <div>Network: {activeNetwork.current}</div>
  </div>
{/if}
```
{% endtab %}
{% endtabs %}

### Core Functionality

All framework adapters provide access to the same core wallet state and methods, with framework-specific reactive wrappers.

#### State Properties

```typescript
interface WalletState {
  activeAccount: WalletAccount | null
  activeAddress: string | null
  activeWallet: Wallet | null
  activeWalletAccounts: WalletAccount[] | null
  activeWalletAddresses: string[] | null
  algodClient: algosdk.Algodv2
  isReady: boolean
  wallets: Wallet[]
}
```

#### Methods

```typescript
interface WalletMethods {
  signTransactions<T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]>
  transactionSigner: algosdk.TransactionSigner
}
```

### Framework-Specific Usage

Each framework adapter provides the same functionality with patterns optimized for that framework's ecosystem.

#### Setup

{% tabs %}
{% tab title="React" %}
```tsx
// App.tsx
import { WalletProvider, WalletManager } from '@txnlab/use-wallet-react'

const manager = new WalletManager({
  // ... WalletManager config
})

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourComponents />
    </WalletProvider>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```typescript
// main.ts
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'

const app = createApp(App)
app.use(WalletManagerPlugin, {
  // ... WalletManager config
})
```
{% endtab %}

{% tab title="Solid" %}
```tsx
// App.tsx
import { WalletProvider, WalletManager } from '@txnlab/use-wallet-solid'

const manager = new WalletManager({
  // ... WalletManager config
})

function App() {
  return (
    <WalletProvider manager={manager}>
      <YourComponents />
    </WalletProvider>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```typescript
// routes/+layout.svelte
<script lang="ts">
  import { useWalletContext, WalletManager } from '@txnlab/use-wallet-svelte'

  const manager = new WalletManager({
    // ... WalletManager config
  })

  useWalletContext(manager)

  let { children } = $props()
</script>

{@render children()}
```
{% endtab %}
{% endtabs %}

See the [framework-specific guides](broken-reference) for detailed setup instructions.

#### State Access

{% tabs %}
{% tab title="React" %}
React provides state directly as properties from the hook:

```tsx
import { useWallet } from '@txnlab/use-wallet-react'

function Component() {
  const { activeAccount } = useWallet()

  return (
    <div>
      {activeAccount && (
        <p>Connected to {activeAccount.name}</p>
      )}
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
Vue returns reactive refs that can be used in templates or unwrapped with `.value`:

```vue
<script setup lang="ts">
  import { useWallet } from '@txnlab/use-wallet-vue'

  const { activeAccount } = useWallet()

  // Access ref value in script
  console.log('Account name:', activeAccount.value?.name)
</script>

<template>
  <div v-if="activeAccount">
    <p>Connected to {{ activeAccount.name }}</p>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
Solid provides state through a getter function and signals:

```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import { Show } from 'solid-js'

function Component() {
  const { activeAccount } = useWallet()
  
  return (
    <Show when={activeAccount()} fallback={null}>
      <p>Connected to {activeAccount()?.name}</p>
    </Show>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
Svelte provides state through a getter functions and reactive objects that can be unwrapped with `.current`:

```sv
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  const { activeAccount } = useWallet()
</script>

{#if activeAccount.current}
  <div>
    <p>Connected to {activeAccount.current.name}</p>
  </div>
{/if}
```
{% endtab %}
{% endtabs %}

#### Complete Example

Here's a complete example showing wallet connection, transaction signing, and error handling in each framework:

{% tabs %}
{% tab title="React" %}
```tsx
import { useNetwork, useWallet, WalletId } from '@txnlab/use-wallet-react'

function WalletComponent() {
  const {
    activeAccount,
    wallets,
    signTransactions
  } = useWallet()

  const { activeNetwork } = useNetwork()

  const handleConnect = async () => {
    const pera = wallets.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.connect()
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleDisconnect = async () => {
    const pera = wallets.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const handleSign = async () => {
    try {
      // Example: Sign a transaction
      // See the Signing Transactions guide for complete examples
      const signedTxns = await signTransactions([/* transactions */])
      console.log('Transaction signed!')
    } catch (error) {
      console.error('Signing failed:', error)
    }
  }

  if (!activeAccount) {
    return <button onClick={handleConnect}>Connect Wallet</button>
  }

  return (
    <div>
      <p>Connected to {activeAccount.name}</p>
      <p>Network: {activeNetwork}</p>
      <button onClick={handleDisconnect}>Disconnect</button>
      <button onClick={handleSign}>Sign Transaction</button>
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useNetwork, useWallet, WalletId } from '@txnlab/use-wallet-vue'

  const {
    activeAccount,
    wallets,
    signTransactions
  } = useWallet()

  const { activeNetwork } = useNetwork()

  const handleConnect = async () => {
    const pera = wallets.value.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.connect()
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleDisconnect = async () => {
    const pera = wallets.value.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const handleSign = async () => {
    try {
      // Example: Sign a transaction
      // See the Signing Transactions guide for complete examples
      const signedTxns = await signTransactions([/* transactions */])
      console.log('Transaction signed!')
    } catch (error) {
      console.error('Signing failed:', error)
      }
  }
</script>

<template>
  <div>
    <template v-if="!activeAccount">
      <button @click="handleConnect">Connect Wallet</button>
    </template>
    <template v-else>
      <p>Connected to {{ activeAccount.name }}</p>
      <p>Network: {{ activeNetwork }}</p>
      <button @click="handleDisconnect">Disconnect</button>
      <button @click="handleSign">Sign Transaction</button>
    </template>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useNetwork, useWallet, WalletId } from '@txnlab/use-wallet-solid'
import { Show } from 'solid-js'

function WalletComponent() {
  const {
    activeAccount,
    wallets,
    signTransactions
  } = useWallet()

  const { activeNetwork } = useNetwork()

  const handleConnect = async () => {
    const pera = wallets().find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.connect()
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleDisconnect = async () => {
    const pera = wallets().find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const handleSign = async () => {
    try {
      // Example: Sign a transaction
      // See the Signing Transactions guide for complete examples
      const signedTxns = await signTransactions([/* transactions */])
      console.log('Transaction signed!')
    } catch (error) {
      console.error('Signing failed:', error)
    }
  }

  return (
    <Show when={activeAccount()} fallback={<button onClick={handleConnect}>Connect Wallet</button>}>
      <div>
        <p>Connected to {activeAccount()?.name}</p>
        <p>Network: {activeNetwork()}</p>
        <button onClick={handleDisconnect}>Disconnect</button>
        <button onClick={handleSign}>Sign Transaction</button>
      </div>
    </Show>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useNetwork, useWallet, WalletId } from '@txnlab/use-wallet-svelte'

  const {
    activeAccount,
    wallets,
    signTransactions
  } = useWallet()

  const { activeNetwork } = useNetwork()

  const handleConnect = async () => {
    const pera = wallets.value.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.connect()
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  const handleDisconnect = async () => {
    const pera = wallets.value.find((w) => w.id === WalletId.PERA)
    if (!pera) return

    try {
      await pera.disconnect()
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }

  const handleSign = async () => {
    try {
      // Example: Sign a transaction
      // See the Signing Transactions guide for complete examples
      const signedTxns = await signTransactions([/* transactions */])
      console.log('Transaction signed!')
    } catch (error) {
      console.error('Signing failed:', error)
      }
  }
</script>

<div>
  {#if !activeAccount.current}
    <button onclick={handleConnect}>Connect Wallet</button>
  {:else}
    <p>Connected to {activeAccount.current.name}</p>
    <p>Network: {activeNetwork.current}</p>
    <button onclick={handleDisconnect}>Disconnect</button>
    <button onclick={handleSign}>Sign Transaction</button>
  {/if}
</div>
```
{% endtab %}
{% endtabs %}

### Framework-Specific Considerations

#### React

* Uses React's Context API for state management
* Compatible with React 16.8+ (requires Hooks)

#### Vue

* Integrated with Vue's reactivity system using `ref` and `computed`
* Can be used in Options API via `inject`
* State properties are automatically unwrapped in templates
* Compatible with Vue 3.x

#### SolidJS

* Uses Solid's fine-grained reactivity system
* State values are accessed via getter functions for reactivity
* Compatible with Solid 1.x

#### Svelte

* State values are accessed via getter functions for reactivity
* Compatible with Svelte 5.x

### Error Handling

By design, wallet operations propagate errors to the consuming application. This allows applications to handle user feedback in a way that best fits their UI/UX patterns, such as displaying toasts, modals, or in-line error messages.

Always wrap async operations in try/catch blocks:

```typescript
try {
  await wallet.connect()
} catch (error) {
  // Handle connection error (e.g., show toast notification)
  console.error('Connection failed:', error)
}

try {
  const signedTxns = await signTransactions([/* transactions */])
} catch (error) {
  // Handle signing error (e.g., show modal with error details)
  console.error('Signing failed:', error)
}
```

See the [Connect Wallet Menu](../guides/connect-wallet-menu.md) and [Signing Transactions](../guides/signing-transactions.md) guide for more detailed error handling examples.

### TypeScript Support

All framework adapters are written in TypeScript and provide full type definitions. State and method types are consistent across frameworks, with framework-specific wrappers where needed (e.g., Vue refs, Solid signals).

### See Also

* [WalletManager](walletmanager.md) - Core functionality documentation
* [Framework Adapters](broken-reference) - Detailed setup guides
* [Example Projects](../resources/example-projects.md) - Complete examples in each framework
