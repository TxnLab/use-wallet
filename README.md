### @txnlab/use-wallet

React hooks for using Algorand compatible wallets with web applications.

### Quick Start

Install with Yarn.

```bash
yarn add @txnlab/use-wallet
```

Install with NPM.

```bash
npm install @txnlab/use-wallet
```

Install the peer dependencies if you don't have them.

With Yarn.

```bash
yarn add @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client algosdk
```

With NPM.

```bash
npm install algosdk @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client
```

Setup the wallet providers

```jsx
import React from "react";
import { useConnectWallet } from "../../index";

type ConnectWalletProps = {
  foo?: string;
};

export default function ConnectWallet(props: ConnectWalletProps) {
  const { providers, reconnectProviders, accounts, activeAccount } =
    useConnectWallet();

  // Reconnect the session when the user returns to the dApp
  React.useEffect(() => {
    reconnectProviders();
  }, []);

  // Use these properties to display connected accounts to users.
  React.useEffect(() => {
    console.log("connected accounts", accounts);
    console.log("active account", activeAccount);
  });

  // Map through the providers, and render "connect", "set active", and "disconnect" buttons
  return (
    <div>
      {providers.map((provider) => (
        <div key={"provider-" + provider.id}>
          <h4>
            <img width={30} height={30} src={provider.icon} />
            {provider.name} {provider.isActive && "[active]"}
          </h4>
          <div>
            {/* If the wallet provider isn't connected, render a "connect" button */}
            {!provider.isConnected && (
              <button onClick={provider.connect}>Connect</button>
            )}
            {/* If the wallet provider is connected and active, render a "disconnect" button */}
            {provider.isConnected && (
              <button onClick={provider.disconnect}>Disonnect</button>
            )}
            {/* If the wallet provider is connected but not active, render a "set active" button */}
            {provider.isConnected && !provider.isActive && (
              <button onClick={provider.setActive}>Set Active</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Sign and send transactions

```jsx
const Wallet = (props: WalletProps) => {
  const { activeAccount, signTransactions, sendTransactions } = useWallet();

  const sendTransaction = async (
    from?: string,
    to?: string,
    amount?: number
  ) => {
    if (!from || !to || !amount) {
      throw new Error("Missing transaction params.");
    }

    const params = await algodClient.getTransactionParams().do();

    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from,
      to,
      amount,
      suggestedParams: params,
    });

    const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction);
    const signedTransactions = await signTransactions([encodedTransaction]);

    const { id } = await sendTransactions(signedTransactions);

    console.log("Successfully sent transaction. Transaction ID: ", id);
  };

  if (!activeAccount) {
    return <p>Connect an account first.</p>;
  }

  return (
    <div>
      {
        <button
          onClick={() =>
            sendTransaction(
              activeAccount?.address,
              activeAccount?.address,
              1000
            )
          }
          className="button"
        >
          Sign and send transactions
        </button>
      }
    </div>
  );
};
```
