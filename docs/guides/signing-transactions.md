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

# Signing Transactions

The `useWallet` hook/composable/primitive provides two methods for signing Algorand transactions:

* `signTransactions` - For directly signing transactions
* `transactionSigner` - For use with transaction composers that accept an `algosdk.TransactionSigner`

### signTransactions

The [`signTransactions`](../api-reference/usewallet.md) method accepts either:

* An array of `algosdk.Transaction` objects
* An array of encoded transactions (`Uint8Array`)
* An array of arrays of either of the above (for transaction groups)

It returns an array of `Uint8Array | null`, where `null` indicates an unsigned transaction.

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'

function SendTransaction() {
  const {
    activeAddress,
    signTransactions,
    algodClient
  } = useWallet()

  const handleSend = async () => {
    if (!activeAddress) return

    try {
      // Create transaction
      const suggestedParams = await algodClient.getTransactionParams().do()
      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        amount: 0,
        suggestedParams
      })

      // Sign transaction
      const signedTxns = await signTransactions([transaction])

      // Send transaction
      const { txid } = await algodClient.sendRawTransaction(signedTxns).do()
      
      // Wait for confirmation
      const result = await algosdk.waitForConfirmation(algodClient, txid, 4)
      console.log(`Transaction confirmed at round ${result['confirmed-round']}`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleSend}>Send Transaction</button>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useWallet } from '@txnlab/use-wallet-vue'
  import algosdk from 'algosdk'

  const {
    activeAddress,
    signTransactions,
    algodClient
  } = useWallet()

  const handleSend = async () => {
    if (!activeAddress.value) return

    try {
      // Create transaction
      const suggestedParams = await algodClient.value.getTransactionParams().do()
      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress.value,
        receiver: activeAddress.value,
        amount: 0,
        suggestedParams
      })

      // Sign transaction
      const signedTxns = await signTransactions([transaction])

      // Send transaction
      const { txid } = await algodClient.value.sendRawTransaction(signedTxns).do()
      
      // Wait for confirmation
      const result = await algosdk.waitForConfirmation(algodClient.value, txid, 4)
      console.log(`Transaction confirmed at round ${result['confirmed-round']}`)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<template>
  <button @click="handleSend">Send Transaction</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'

function SendTransaction() {
  const {
    activeAddress,
    signTransactions,
    algodClient
  } = useWallet()

  const handleSend = async () => {
    if (!activeAddress()) return

    try {
      // Create transaction
      const suggestedParams = await algodClient().getTransactionParams().do()
      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress(),
        receiver: activeAddress(),
        amount: 0,
        suggestedParams
      })

      // Sign transaction
      const signedTxns = await signTransactions([transaction])

      // Send transaction
      const { txid } = await algodClient().sendRawTransaction(signedTxns).do()
      
      // Wait for confirmation
      const result = await algosdk.waitForConfirmation(algodClient(), txid, 4)
      console.log(`Transaction confirmed at round ${result['confirmed-round']}`)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleSend}>Send Transaction</button>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  import algosdk from 'algosdk'

  const {
    activeAddress,
    signTransactions,
    algodClient
  } = useWallet()

  const handleSend = async () => {
    if (!activeAddress.current) return

    try {
      // Create transaction
      const suggestedParams = await algodClient.current.getTransactionParams().do()
      const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress.current,
        receiver: activeAddress.current,
        amount: 0,
        suggestedParams
      })

      // Sign transaction
      const signedTxns = await signTransactions([transaction])

      // Send transaction
      const { txid } = await algodClient.current.sendRawTransaction(signedTxns).do()
      
      // Wait for confirmation
      const result = await algosdk.waitForConfirmation(algodClient.current, txid, 4)
      console.log(`Transaction confirmed at round ${result['confirmed-round']}`)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<button onclick={handleSend}>Send Transaction</button>
```
{% endtab %}
{% endtabs %}

For more information about constructing and sending transactions with the Algorand JavaScript SDK, see the [JS SDK: Your First Transaction](https://developer.algorand.org/docs/sdks/javascript/) guide in the Algorand Developer Portal.

### transactionSigner

The [`transactionSigner`](../api-reference/usewallet.md) provides a typed `algosdk.TransactionSigner` that can be used with transaction composers. This is particularly useful when working with ABI method calls or when you need to compose multiple transactions.

#### With Atomic Transaction Composer

The `AtomicTransactionComposer` (ATC) is the recommended way to build and execute groups of transactions, especially when working with smart contracts.

Here's an example using ATC to combine an ABI method call with a payment transaction:

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import algosdk from 'algosdk'

function CallContractAtc() {
  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress) return

    try {
      // Create ATC instance
      const atc = new algosdk.AtomicTransactionComposer()
      
      // Get suggested params
      const suggestedParams = await algodClient.getTransactionParams().do()
      
      // Add ABI method call
      const method = algosdk.ABIMethod.fromSignature('hello(string)string')
      atc.addMethodCall({
        sender: activeAddress,
        signer: transactionSigner,
        appID: 123,
        method,
        methodArgs: ['World'],
        suggestedParams,
      })

      // Add payment transaction
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: activeAddress,
        amount: 1000,
        suggestedParams,
      })
      atc.addTransaction({ txn: paymentTxn, signer: transactionSigner })

      // Execute transaction group
      const result = await atc.execute(algodClient, 4)
      console.log('Transaction confirmed:', result.txIDs[0])
      
      // Get return value from ABI method
      const returnValue = result.methodResults[0].returnValue
      console.log('Return value:', returnValue)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleCall}>Call Contract</button>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useWallet } from '@txnlab/use-wallet-vue'
  import algosdk from 'algosdk'

  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress.value) return

    try {
      // Create ATC instance
      const atc = new algosdk.AtomicTransactionComposer()
      
      // Get suggested params
      const suggestedParams = await algodClient.value.getTransactionParams().do()
      
      // Add ABI method call
      const method = algosdk.ABIMethod.fromSignature('hello(string)string')
      atc.addMethodCall({
        sender: activeAddress.value,
        signer: transactionSigner,
        appID: 123,
        method,
        methodArgs: ['World'],
        suggestedParams,
      })

      // Add payment transaction
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress.value,
        receiver: activeAddress.value,
        amount: 1000,
        suggestedParams,
      })
      atc.addTransaction({ txn: paymentTxn, signer: transactionSigner })

      // Execute transaction group
      const result = await atc.execute(algodClient.value, 4)
      console.log('Transaction confirmed:', result.txIDs[0])
      
      // Get return value from ABI method
      const returnValue = result.methodResults[0].returnValue
      console.log('Return value:', returnValue)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<template>
  <button @click="handleCall">Call Contract</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import algosdk from 'algosdk'

function CallContractAtc() {
  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress()) return

    try {
      // Create ATC instance
      const atc = new algosdk.AtomicTransactionComposer()
      
      // Get suggested params
      const suggestedParams = await algodClient().getTransactionParams().do()
      
      // Add ABI method call
      const method = algosdk.ABIMethod.fromSignature('hello(string)string')
      atc.addMethodCall({
        sender: activeAddress(),
        signer: transactionSigner,
        appID: 123,
        method,
        methodArgs: ['World'],
        suggestedParams,
      })

      // Add payment transaction
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress(),
        receiver: activeAddress(),
        amount: 1000,
        suggestedParams,
      })
      atc.addTransaction({ txn: paymentTxn, signer: transactionSigner })

      // Execute transaction group
      const result = await atc.execute(algodClient(), 4)
      console.log('Transaction confirmed:', result.txIDs[0])
      
      // Get return value from ABI method
      const returnValue = result.methodResults[0].returnValue
      console.log('Return value:', returnValue)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleCall}>Call Contract</button>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  import algosdk from 'algosdk'

  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress.current) return

    try {
      // Create ATC instance
      const atc = new algosdk.AtomicTransactionComposer()
      
      // Get suggested params
      const suggestedParams = await algodClient.current.getTransactionParams().do()
      
      // Add ABI method call
      const method = algosdk.ABIMethod.fromSignature('hello(string)string')
      atc.addMethodCall({
        sender: activeAddress.current,
        signer: transactionSigner,
        appID: 123,
        method,
        methodArgs: ['World'],
        suggestedParams,
      })

      // Add payment transaction
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress.current,
        receiver: activeAddress.current,
        amount: 1000,
        suggestedParams,
      })
      atc.addTransaction({ txn: paymentTxn, signer: transactionSigner })

      // Execute transaction group
      const result = await atc.execute(algodClient.current, 4)
      console.log('Transaction confirmed:', result.txIDs[0])
      
      // Get return value from ABI method
      const returnValue = result.methodResults[0].returnValue
      console.log('Return value:', returnValue)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<button onclick={handleCall}>Call Contract</button>
```
{% endtab %}
{% endtabs %}

For more information, see the [Atomic Transaction Composer guide](https://developer.algorand.org/docs/get-details/atc/) in the Algorand Developer Portal.

#### With AlgoKit Utils

The most powerful way to interact with Algorand is using [AlgoKit Utils](https://github.com/algorandfoundation/algokit-utils-ts)' `AlgorandClient`. This class provides a unified interface for all Algorand functionality, including:

* Smart contract interactions via typed clients
* Transaction creation and composition
* Fee calculations and simulation

Here's the same transaction group (ABI method call + payment) composed using AlgoKit Utils:

{% tabs %}
{% tab title="React" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldClient } from './artifacts/HelloWorld/client'

function CallContractAlgoKit() {
  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress) return

    try {
      // Initialize AlgorandClient with algodClient and signer from use-wallet
      const algorand = AlgorandClient
        .fromClients({ algod: algodClient })
        .setSigner(activeAddress, transactionSigner)

      // Get typed app client instance
      const client = algorand.client.getTypedAppClientById(HelloWorldClient, {
        appId: 123n,
      })
      
      // Compose and send transaction group
      const result = await client
        .newGroup()
        // Add ABI method call (type-safe!)
        .hello({ args: { name: 'World' } })
        // Add payment transaction
        .addTransaction(
          algorand.createTransaction.payment({
            sender: activeAddress,
            receiver: activeAddress,
            amount: (1000).microAlgo()
          })
        )
        .execute()

      console.log('Transaction confirmed:', result.transaction.txID())
      console.log('Return value:', result.return)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleCall}>Call Contract</button>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useWallet } from '@txnlab/use-wallet-vue'
  import { AlgorandClient } from '@algorandfoundation/algokit-utils'
  import { HelloWorldClient } from './artifacts/HelloWorld/client'

  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress.value) return

    try {
      // Initialize AlgorandClient with algodClient and signer from use-wallet
      const algorand = AlgorandClient
        .fromClients({ algod: algodClient.value })
        .setSigner(activeAddress.value, transactionSigner)

      // Get typed app client instance
      const client = algorand.client.getTypedAppClientById(HelloWorldClient, {
        appId: 123n,
      })
      
      // Compose and send transaction group
      const result = await client
        .newGroup()
        // Add ABI method call (type-safe!)
        .hello({ args: { name: 'World' } })
        // Add payment transaction
        .addTransaction(
          algorand.createTransaction.payment({
            sender: activeAddress.value,
            receiver: activeAddress.value,
            amount: (1000).microAlgo()
          })
        )
        .execute()

      console.log('Transaction confirmed:', result.transaction.txID())
      console.log('Return value:', result.return)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<template>
  <button @click="handleCall">Call Contract</button>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useWallet } from '@txnlab/use-wallet-solid'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { HelloWorldClient } from './artifacts/HelloWorld/client'

function CallContractAlgoKit() {
  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress()) return

    try {
      // Initialize AlgorandClient with algodClient and signer from use-wallet
      const algorand = AlgorandClient
        .fromClients({ algod: algodClient() })
        .setSigner(activeAddress(), transactionSigner)

      // Get typed app client instance
      const client = algorand.client.getTypedAppClientById(HelloWorldClient, {
        appId: 123n,
      })
      
      // Compose and send transaction group
      const result = await client
        .newGroup()
        // Add ABI method call (type-safe!)
        .hello({ args: { name: 'World' } })
        // Add payment transaction
        .addTransaction(
          algorand.createTransaction.payment({
            sender: activeAddress(),
            receiver: activeAddress(),
            amount: (1000).microAlgo()
          })
        )
        .execute()

      console.log('Transaction confirmed:', result.transaction.txID())
      console.log('Return value:', result.return)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <button onClick={handleCall}>Call Contract</button>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  import { AlgorandClient } from '@algorandfoundation/algokit-utils'
  import { HelloWorldClient } from './artifacts/HelloWorld/client'

  const {
    activeAddress,
    transactionSigner,
    algodClient
  } = useWallet()

  const handleCall = async () => {
    if (!activeAddress.current) return

    try {
      // Initialize AlgorandClient with algodClient and signer from use-wallet
      const algorand = AlgorandClient
        .fromClients({ algod: algodClient.current })
        .setSigner(activeAddress.current, transactionSigner)

      // Get typed app client instance
      const client = algorand.client.getTypedAppClientById(HelloWorldClient, {
        appId: 123n,
      })
      
      // Compose and send transaction group
      const result = await client
        .newGroup()
        // Add ABI method call (type-safe!)
        .hello({ args: { name: 'World' } })
        // Add payment transaction
        .addTransaction(
          algorand.createTransaction.payment({
            sender: activeAddress.current,
            receiver: activeAddress.current,
            amount: (1000).microAlgo()
          })
        )
        .execute()

      console.log('Transaction confirmed:', result.transaction.txID())
      console.log('Return value:', result.return)
    } catch (error) {
      console.error('Error:', error)
    }
  }
</script>

<button onclick={handleCall}>Call Contract</button>
```
{% endtab %}
{% endtabs %}

For more information, see:

* [AlgoKit Utils (GitHub)](https://github.com/algorandfoundation/algokit-utils-ts)
* [AlgorandClient documentation](https://github.com/algorandfoundation/algokit-utils-ts/blob/main/docs/capabilities/algorand-client.md)
* [Application Client Usage documentation](https://github.com/algorandfoundation/algokit-client-generator-ts/blob/main/docs/usage.md)
* [TransactionComposer documentation](https://github.com/algorandfoundation/algokit-utils-ts/blob/main/docs/capabilities/transaction-composer.md)
