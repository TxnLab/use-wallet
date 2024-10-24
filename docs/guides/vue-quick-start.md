---
description: Guide for using the @txnlab/use-wallet-vue package in your Vue project
---

# ⚡ Vue Quick Start

The Vue adapter is a plugin that injects a `WalletManager` instance into the Vue app's context. It exposes a `useWallet` composable function, which lets you access the wallet manager from anywhere in your app.

{% hint style="info" %}
Before proceeding with this Quick Start guide, please read the [Get Started](../fundamentals/get-started/) section for installation and configuration instructions.
{% endhint %}

## WalletManagerPlugin

In the root of your application, install the plugin with your [configuration](../fundamentals/get-started/configuration.md) object.

```typescript
import { NetworkId, WalletId, WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

// Install the plugin
app.use(WalletManagerPlugin, {
  wallets: [...],
  network: NetworkId.TESTNET
})

app.mount('#app')
```

## Wallet Menu

Now, in any component you have access the wallet manager and its state via the `useWallet` composable. Here is an example of a basic wallet menu implementation:

```typescript
<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'

const { wallets, activeWallet, activeAccount } = useWallet()
</script>

<template>
  <div>
    <h2>Wallets</h2>
    <ul>
      <li v-for="wallet in wallets" :key="wallet.id">
        <button @click="wallet.connect()">{{ wallet.metadata.name }}</button>
      </li>
    </ul>

    <div v-if="activeWallet">
      <h2>Active Wallet</h2>
      <p>{{ activeWallet.metadata.name }}</p>
      <h2>Active Account</h2>
      <p>{{ activeAccount.address }}</p>
      <button @click="activeWallet.disconnect()">Disconnect</button>
    </div>
  </div>
</template>
```

## Signing Transactions

To sign and send transactions, you can use the library's `algodClient` instance and the `transactionSigner` provided by the active wallet.

```typescript
<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'
import algosdk from 'algosdk'

const { algodClient, activeAddress, transactionSigner } = useWallet()

const sendAlgos = async () => {
  const atc = new algosdk.AtomicTransactionComposer()
  const suggestedParams = await algodClient.value.getTransactionParams().do()

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: activeAddress,
    to: '<RECIPIENT_ADDRESS>',
    amount: 15000000,
    suggestedParams
  })

  atc.addTransaction({ txn, signer: transactionSigner })

  await atc.execute(algodClient, 4)
}
</script>

<template>
  <button @click="sendAlgos">Buy dev a Lavazza ☕️</button>
</template>
```

## Example Applications

To see fully functioning Vue examples, check out these example apps:

* [Vue Example App](https://github.com/TxnLab/use-wallet/tree/main/examples/vue-ts)
* [Nuxt.js Example App](https://github.com/TxnLab/use-wallet/tree/main/examples/nuxt)
