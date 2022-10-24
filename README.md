# @TxnLab/use-wallet

React hooks for using Algorand compatible wallets with web applications.

## Demo

Preview a basic implementation in [Storybook](https://txnlab.github.io/use-wallet) or check out [this example](https://github.com/gabrielkuettel/use-wallet-example).

## Quick Start

⚠️ If you're using Webpack 5 (most newer React projects), you will need to install polyfills. Follow [these directions](#webpack-5).

### Yarn

```bash
yarn add @txnlab/use-wallet
```

Install peer dependencies (if needed)

```bash
yarn add algosdk @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client algorand-walletconnect-qrcode-modal
```

### NPM

```bash
npm install @txnlab/use-wallet
```

Install peer dependencies (if needed)

```bash
npm install algosdk @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client algorand-walletconnect-qrcode-modal
```

### Set up the wallet providers

```jsx
import React from "react";
import { useConnectWallet } from "@txnlab/use-wallet";

function App() {
    const {
    providers,
    reconnectProviders,
    accounts,
    activeAccount,
    selectActiveAccount,
  } = useConnectWallet();

  // Reconnect the session when the user returns to the dApp
  React.useEffect(() => {
    reconnectProviders();
  }, []);

  // Use these properties to display connected accounts to users.
  // They are reactive and presisted to local storage.
  React.useEffect(() => {
    console.log("connected accounts", accounts);
    console.log("active account", activeAccount);
  });

  // Map through the providers, and render account information and "connect", "set active", and "disconnect" buttons
  return (
    <div>
      {providers.map((provider) => (
        <div key={"provider-" + provider.id}>
          <h4>
            <img width={30} height={30} src={provider.icon} />
            {provider.name} {provider.isActive && "[active]"}
          </h4>
          <div>
            <button onClick={provider.connect} disabled={provider.isConnected}>
              Connect
            </button>
            <button onClick={provider.disconnect} disabled={!provider.isConnected}>
              Disonnect
            </button>
            <button onClick={provider.setActive} disabled={!provider.isConnected || provider.isActive}>
              Set Active
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Each provider has two connection states: `isConnected` and `isActive`.

`isConnected` means that the user has authorized the provider to talk to the dApp. The connection flow does not need to be restarted when switching to this wallet from a different one.

`isActive` indicates that the provider is currently active and will be used to sign and send transactions when using the `useWallet` hook.

To support wallets that allow users to connect multiple accounts, you can map through `accounts` and use `selectActiveAccount` to switch between them.

```jsx
<select
  value={activeAccount.address}
  onChange={(e) =>
    selectActiveAccount(
      activeAccount.providerId,
      e.target.value
    )
  }
>
  {accounts.map((account) => (
    <option value={account.address}>{account.address}</option>
  ))}
</select>
```

### Sign and send transactions

```jsx
import React from "react";
import { useWallet } from "@txnlab/use-wallet";

function Wallet() {
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

  // Construct a transaction to be signed and sent. 
    const transaction = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from,
      to,
      amount,
      suggestedParams: params,
    });

    // Encode the transactions into a byte array.
    const encodedTransaction = algosdk.encodeUnsignedTransaction(transaction);

    // Sign the transactions.
    const signedTransactions = await signTransactions([encodedTransaction]);

    // Send the transactions.
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

## Setup Environments

The wallets connect to Algorand [MainNet](https://developer.algorand.org/docs/get-details/algorand-networks/mainnet) by default.
You can change this by overriding the `NODE_SERVER`, `NODE_TOKEN`, `NODE_PORT` and `NODE_NETWORK` environment variables.

`NODE_NETWORK` defaults to `mainnet`, and can be set to `testnet`, `betanet`, or the name of a local network running in dev mode.

Please note, for React and Next.js projects, you must prefix the environment variables with `REACT_APP_` or `NEXT_PUBLIC_` respectively.

## Webpack 5

1. Install `react-app-rewired` and the missing polyfills.

    ```bash
    yarn add --dev react-app-rewired crypto-browserify stream-browserify assert stream-http https-browserify os-browserify url buffer process
    ```

2. Create `config-overrides.js` in the root of your project and add the following:

    ```js
    const webpack = require("webpack");
    
    module.exports = function override(config) {
      const fallback = config.resolve.fallback || {};
      Object.assign(fallback, {
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        assert: require.resolve("assert"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        os: require.resolve("os-browserify"),
        url: require.resolve("url"),
      });
      config.resolve.fallback = fallback;
      config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
          process: "process/browser",
          Buffer: ["buffer", "Buffer"],
        }),
      ]);
      return config;
    };
    ```

3. Change your scripts in `package.json` to the following:

    ```js
    "scripts": {
        "start": "react-app-rewired start",
        "build": "react-app-rewired build",
        "test": "react-app-rewired test",
        "eject": "react-scripts eject"
    },
    ```

## Local Development

### Install dependencies

```bash
yarn install
```

### Demo in Storybook

```bash
yarn storybook

```

### Build the library

```bash
yarn build
```

## License

See the [LICENSE](https://github.com/TxnLab/use-wallet/blob/main/LICENSE.md) file for license rights and limitations (MIT)
