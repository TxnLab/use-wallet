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

# Connect Wallet Menu

This guide demonstrates one approach to building a wallet connection interface using use-wallet. Being a headless library, use-wallet gives you complete control over your wallet UI implementation - you're free to design the interface that best suits your application's needs.

### A Simple Pattern

One straightforward approach is to implement a wallet menu with two distinct states:

1. **Disconnected State**: Shows a list of available wallets to choose from
2. **Connected State**: Shows details and controls for a single active wallet

While use-wallet supports connecting multiple wallets simultaneously, focusing on a single active wallet can:

* Simplify the user experience
* Reduce complexity in state management
* Make edge cases easier to handle
* Help avoid potential conflicts between certain wallet providers

This is just one possible pattern - the library's flexible design allows you to implement whatever interface makes sense for your application.

### Basic Implementation

Here's a simple implementation that follows this pattern:

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet, type Wallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

const WalletMenu = () => {
  const { wallets, activeWallet } = useWallet()
  
  // If we have an active wallet, show the connected view
  if (activeWallet) {
    return <ConnectedWallet wallet={activeWallet} />
  }
  
  // Otherwise, show the wallet selection list
  return <WalletList wallets={wallets} />
}

const WalletList = ({ wallets }: { wallets: Wallet[] }) => {
  return (
    <div className="wallet-list">
      <h3>Connect Wallet</h3>
      <div className="wallet-options">
        {wallets.map((wallet) => (
          <WalletOption
            key={wallet.id}
            wallet={wallet}
          />
        ))}
      </div>
    </div>
  )
}

const WalletOption = ({ wallet }: { wallet: Wallet }) => {
  const [connecting, setConnecting] = useState(false)
  
  const handleConnect = async () => {
    setConnecting(true)
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(false)
    }
  }
  
  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="wallet-option"
    >
      <img
        src={wallet.metadata.icon}
        alt={wallet.metadata.name}
        width={32}
        height={32}
      />
      <span>{wallet.metadata.name}</span>
    </button>
  )
}

const ConnectedWallet = ({ wallet }: { wallet: Wallet }) => {
  return (
    <div className="connected-wallet">
      {/* Wallet header */}
      <div className="wallet-header">
        <img
          src={wallet.metadata.icon}
          alt={wallet.metadata.name}
          width={32}
          height={32}
        />
        <span>{wallet.metadata.name}</span>
      </div>
      
      {/* Account selector */}
      {wallet.accounts.length > 1 && (
        <select
          value={wallet.activeAccount?.address}
          onChange={(e) => wallet.setActiveAccount(e.target.value)}
        >
          {wallet.accounts.map((account) => (
            <option key={account.address} value={account.address}>
              {account.name}
            </option>
          ))}
        </select>
      )}
      
      {/* Account details */}
      {wallet.activeAccount && (
        <div className="account-info">
          <span>{wallet.activeAccount.name}</span>
          <span>{wallet.activeAccount.address}</span>
        </div>
      )}
      
      {/* Disconnect button */}
      <button onClick={wallet.disconnect}>
        Disconnect
      </button>
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useWallet, type Wallet } from '@txnlab/use-wallet-vue'
  import { ref } from 'vue'

  const { wallets, activeWallet } = useWallet()
  const connecting = ref(false)

  const handleConnect = async (wallet: Wallet) => {
    connecting.value = true
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      connecting.value = false
    }
  }

  const setActiveAccount = (event: Event, wallet: Wallet) => {
    const selectElement = event.target as HTMLSelectElement
    wallet.setActiveAccount(selectElement.value)
  }
</script>

<template>
  <div>
    <!-- Connected state -->
    <div v-if="activeWallet" class="connected-wallet">
      <div class="wallet-header">
        <img
          :src="activeWallet.metadata.icon"
          :alt="activeWallet.metadata.name"
          width="32"
          height="32"
        />
        <span>{{ activeWallet.metadata.name }}</span>
      </div>

      <select
        v-if="activeWallet.accounts.length > 1"
        :value="activeWallet.activeAccount?.address"
        @change="(event) => setActiveAccount(event, activeWallet)"
      >
        <option
          v-for="account in activeWallet.accounts"
          :key="account.address"
          :value="account.address"
        >
          {{ account.name }}
        </option>
      </select>

      <div v-if="activeWallet.activeAccount" class="account-info">
        <span>{{ activeWallet.activeAccount.name }}</span>
        <span>{{ activeWallet.activeAccount.address }}</span>
      </div>

      <button @click="activeWallet.disconnect">
        Disconnect
      </button>
    </div>

    <!-- Disconnected state -->
    <div v-else class="wallet-list">
      <h3>Connect Wallet</h3>
      <div class="wallet-options">
        <button
          v-for="wallet in wallets"
          :key="wallet.id"
          @click="() => handleConnect(wallet)"
          :disabled="connecting"
          class="wallet-option"
        >
          <img
            :src="wallet.metadata.icon"
            :alt="wallet.metadata.name"
            width="32"
            height="32"
          />
          <span>{{ wallet.metadata.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWallet, type BaseWallet } from '@txnlab/use-wallet-solid'
import { createSignal, For, Show } from 'solid-js'

const WalletMenu = () => {
  const { wallets, activeWallet, activeAccount } = useWallet()
  const [connecting, setConnecting] = createSignal(false)

  const handleConnect = async (wallet: BaseWallet) => {
    setConnecting(true)
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(false)
    }
  }

  const setActiveAccount = (event: Event, wallet: BaseWallet) => {
    const target = event.target as HTMLSelectElement
    wallet.setActiveAccount(target.value)
  }

  return (
    <div>
      <Show
        when={activeWallet()}
        fallback={
          <div class="wallet-list">
            <h3>Connect Wallet</h3>
            <div class="wallet-options">
              <For each={wallets}>
                {(wallet) => (
                  <button
                    onClick={() => handleConnect(wallet)}
                    disabled={connecting()}
                    class="wallet-option"
                  >
                    <img
                      src={wallet.metadata.icon}
                      alt={wallet.metadata.name}
                      width={32}
                      height={32}
                    />
                    <span>{wallet.metadata.name}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        }
      >
        {(wallet) => (
          <div class="connected-wallet">
            <div class="wallet-header">
              <img
                src={wallet().metadata.icon}
                alt={wallet().metadata.name}
                width={32}
                height={32}
              />
              <span>{wallet().metadata.name}</span>
            </div>

            <Show when={wallet().accounts.length > 1}>
              <select onChange={(e) => setActiveAccount(e, wallet())}>
                <For each={wallet().accounts}>
                  {(account) => (
                    <option value={account.address}>
                      {account.name}
                    </option>
                  )}
                </For>
              </select>
            </Show>

            <Show when={activeAccount()}>
              {(account) => (
                <div class="account-info">
                  <span>{account().name}</span>
                  <span>{account().address}</span>
                </div>
              )}
            </Show>

            <button onClick={() => wallet().disconnect()}>
              Disconnect
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useWallet, type Wallet } from '@txnlab/use-wallet-svelte'

  const { wallets, activeWallet } = useWallet()
  const connecting = $state(false)

  const handleConnect = async (wallet: Wallet) => {
    connecting = true
    try {
      await wallet.connect()
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      connecting = false
    }
  }

  const setActiveAccount = (event: Event, wallet: Wallet) => {
    const selectElement = event.target as HTMLSelectElement
    wallet.setActiveAccount(selectElement.value)
  }
</script>

<div>
  {#if activeWallet()}
    <!-- Connected state -->
    <div class="connected-wallet">
      <div class="wallet-header">
        <img
          src={activeWallet().metadata.icon}
          alt={activeWallet().metadata.name}
          width="32"
          height="32"
        />
        <span>{activeWallet().metadata.name}</span>
      </div>

      {#if activeWallet().accounts.length > 1}
        <select
          value={activeWallet().activeAccount?.address}
          onchange={(event) => setActiveAccount(event, activeWallet())}
        >
          {#each activeWallet().accounts as account}
            <option value={account.address}>
              {account.name}
            </option>
          {/each}
        </select>
      {/if}

      {#if activeWallet().activeAccount}
        <div class="account-info">
          <span>{activeWallet().activeAccount.name}</span>
          <span>{activeWallet().activeAccount.address}</span>
        </div>
      {/if}

      <button onclick={activeWallet().disconnect}>
        Disconnect
      </button>
    </div>
  {:else}
    <!-- Disconnected state -->
    <div class="wallet-list">
      <h3>Connect Wallet</h3>
      <div class="wallet-options">
        {#each wallets as wallet}
          <button
            onclick={() => handleConnect(wallet)}
            disabled={connecting}
            class="wallet-option"
          >
            <img
              src={wallet.metadata.icon}
              alt={wallet.metadata.name}
              width="32"
              height="32"
            />
            <span>{wallet.metadata.name}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
```
{% endtab %}
{% endtabs %}

### Error Handling and Loading States

Here's how to implement basic error handling and loading states for wallet interactions:

{% tabs %}
{% tab title="React" %}
```tsx
const WalletOption = ({ wallet }: { wallet: Wallet }) => {
  const [status, setStatus] = useState('idle')
  
  const handleConnect = async () => {
    setStatus('connecting')
    try {
      await wallet.connect()
      setStatus('connected')
    } catch (error) {
      setStatus('error')
      showNotification('Failed to connect wallet')
      console.error('Connection error:', error)
    }
  }
  
  return (
    <button
      onClick={handleConnect}
      disabled={status === 'connecting'}
    >
      {status === 'connecting' ? 'Connecting...' : 'Connect'}
    </button>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  const status = ref('idle')

  const handleConnect = async (wallet: Wallet) => {
    status.value = 'connecting'
    try {
      await wallet.connect()
      status.value = 'connected'
    } catch (error) {
      status.value = 'error'
      showNotification('Failed to connect wallet')
      console.error('Connection error:', error)
    }
  }
</script>

<template>
  <button
    @click="handleConnect(wallet)"
    :disabled="status === 'connecting'"
  >
    {{ status === 'connecting' ? 'Connecting...' : 'Connect' }}
  </button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
const WalletOption = ({ wallet }: { wallet: BaseWallet }) => {
  const [status, setStatus] = createSignal('idle')
  
  const handleConnect = async () => {
    setStatus('connecting')
    try {
      await wallet.connect()
      setStatus('connected')
    } catch (error) {
      setStatus('error')
      showNotification('Failed to connect wallet')
      console.error('Connection error:', error)
    }
  }
  
  return (
    <button
      onClick={handleConnect}
      disabled={status() === 'connecting'}
    >
      {status() === 'connecting' ? 'Connecting...' : 'Connect'}
    </button>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  const status = $state('idle')

  const handleConnect = async (wallet: Wallet) => {
    status = 'connecting'
    try {
      await wallet.connect()
      status = 'connected'
    } catch (error) {
      status = 'error'
      showNotification('Failed to connect wallet')
      console.error('Connection error:', error)
    }
  }
</script>

<button
  onclick={() => handleConnect(wallet)}
  disabled={status === 'connecting'}
>
  {status === 'connecting' ? 'Connecting...' : 'Connect'}
</button>
```
{% endtab %}
{% endtabs %}

### Accessibility

Ensure your wallet menu is accessible:

```tsx
<div
  role="dialog"
  aria-labelledby="wallet-menu-title"
  className="wallet-menu"
>
  <h2 id="wallet-menu-title">
    {activeWallet ? 'Connected Wallet' : 'Connect Wallet'}
  </h2>
  
  {/* Menu content */}
</div>
```

### Next Steps

* Add styling to match your application's design
* Implement a modal/dropdown container for the menu
* Add balance display for active account
* Optional: Add network selection (see [Switching Networks](switching-networks.md))

### See Also

* [Signing Transactions](signing-transactions.md)
* [Runtime Node Configuration](runtime-node-configuration.md)
* [Example Projects](../resources/example-projects.md)
