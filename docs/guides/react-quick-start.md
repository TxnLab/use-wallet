---
description: Guide for using the @txnlab/use-wallet-react package in your React project
---

# ⚡ React Quick Start

The `useWallet` custom React hook provides access to the `WalletManager` instance and its state. It abstracts the `WalletManager` API and provides a simple interface for building a wallet menu and interacting with the active wallet.

{% hint style="info" %}
Before proceeding with this Quick Start guide, please read the [Get Started](../fundamentals/get-started/) section for installation and configuration instructions.
{% endhint %}

## WalletProvider

In the root of your application, create a `WalletManager` instance with your [configuration](../fundamentals/get-started/configuration.md) object. Wrap your app with the `WalletProvider` and pass the `WalletManager` instance as a prop.

```jsx
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider
} from '@txnlab/use-wallet-react'
import ReactDOM from 'react-dom/client'

// Create a manager instance
const walletManager = new WalletManager({
  wallets: [...],
  network: NetworkId.TESTNET
})

function App() {
  return (
    // Provide the manager to your App
    <WalletProvider manager={walletManager}>
      <MyApp />
    </WalletProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
```

## Wallet Menu

Now, in any component, you can use the `useWallet` hook to access the wallet manager and its state. Here is an example of a basic wallet menu implementation:

```jsx
import { useWallet } from '@txnlab/use-wallet-react'

function WalletMenu() {
  const { wallets, activeWallet, activeAccount, isReady } = useWallet()

  if (!isReady) {
    return <div>Initializing wallet manager...</div>
  }

  return (
    <div>
      <h2>Wallets</h2>
      <ul>
        {wallets.map((wallet) => (
          <li key={wallet.id}>
            <button onClick={() => wallet.connect()}>{wallet.metadata.name}</button>
          </li>
        ))}
      </ul>

      {activeWallet && (
        <div>
          <h2>Active Wallet</h2>
          <p>{activeWallet.metadata.name}</p>
          <h2>Active Account</h2>
          <p>{activeAccount?.address}</p>
          <button onClick={() => activeWallet.disconnect()}>Disconnect</button>
        </div>
      )}
    </div>
  )
}
```

The `isReady` state indicates whether the wallet manager has completed initialization. It starts as `false` during both SSR and initial client-side mounting. During the first mount, the `WalletProvider` automatically attempts to restore any previously connected wallet sessions. Once this process completes, `isReady` switches to `true`.

## Signing Transactions

To sign and send transactions, you can use the library's `algodClient` instance and the `transactionSigner` provided by the active wallet.

```jsx
import { useWallet } from '@txnlab/use-wallet-react'
import { algosdk } from 'algosdk'

function SendAlgos() {
  const { algodClient, activeAddress, transactionSigner } = useWallet()

  const sendAlgos = async () => {
    const atc = new algosdk.AtomicTransactionComposer()
    const suggestedParams = await algodClient.getTransactionParams().do()

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: '<RECIPIENT_ADDRESS>',
      amount: 15000000,
      suggestedParams
    })

    atc.addTransaction({ txn, signer: transactionSigner })

    await atc.execute(algodClient, 4)
  }

  return <button onClick={sendAlgos}>Buy dev a Lavazza ☕️</button>
}
```

## Example Applications

To see fully functioning React examples, check out these example apps:

* [React Example App](https://github.com/TxnLab/use-wallet/tree/main/examples/react-ts)
* [Next.js Example App](https://github.com/TxnLab/use-wallet/tree/main/examples/nextjs)
