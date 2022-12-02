# @TxnLab/use-wallet

React hooks for using Algorand compatible wallets with web applications.

## Supported Providers

- [Pera](https://perawallet.app/)
- [MyAlgo](https://wallet.myalgo.com/home)
- [Defly](https://defly.app)
- [AlgoSigner](https://www.purestake.com/technology/algosigner)
- [Exodus](https://www.exodus.com)
- [WalletConnect](https://walletconnect.com)
- [KMD](https://developer.algorand.org/docs/rest-apis/kmd)


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
yarn add algosdk @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client algorand-walletconnect-qrcode-modal @json-rpc-tools/utils
```

### NPM

```bash
npm install @txnlab/use-wallet
```

Install peer dependencies (if needed)

```bash
npm install algosdk @blockshake/defly-connect @perawallet/connect @randlabs/myalgo-connect @walletconnect/client algorand-walletconnect-qrcode-modal @json-rpc-tools/utils
```

### Set up the wallet providers

```jsx
import React from "react";
import { useConnectWallet } from "@txnlab/use-wallet";

function App() {
  const { providers, reconnectProviders, accounts, selectedAccount } = useConnectWallet();

  // Reconnect the session when the user returns to the dApp
  React.useEffect(() => {
    reconnectProviders();
  }, []);

  // Use these properties to display connected accounts to users.
  // They are reactive and presisted to local storage.
  React.useEffect(() => {
    console.log("connected accounts", accounts);
    console.log("active account", selectedAccount);
  });

  // Map through the providers.
  // Render account information and "connect", "set active", and "disconnect" buttons.
  // Finally, map through the `accounts` property to render a dropdown for each connected account.
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
            {provider.isActive && provider.accounts.length && (
              <select
                value={provider.selectedAccount?.address}
                onChange={(e) => provider.selectAccount(e.target.value)}
              >
                {provider.accounts.map((account) => (
                  <option value={account.address}>{account.address}</option>
                ))}
              </select>
             )}
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

By default, all of the supported providers except for `KMD` are returned by `useConnectWallet`. A configuration object can be passed to determine which providers your dApp suports, as shown below.

```jsx
import { useConnectWallet, PROVIDER_ID } from "@txnlab/use-wallet";

...

const { providers } = useConnectWallet({
  providers: [
    PROVIDER_ID.MYALGO_WALLET,
    PROVIDER_ID.PERA_WALLET,
    PROVIDER_ID.KMD_WALLET,
  ],
});
```

### Sign and send transactions

```jsx
import React from "react";
import { useWallet } from "@txnlab/use-wallet";

function Wallet() {
  const { selectedAccount, signTransactions, sendTransactions } = useWallet();

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

  if (!selectedAccount) {
    return <p>Connect an account first.</p>;
  }

  return (
    <div>
      {
        <button
          onClick={() =>
            sendTransaction(
              selectedAccount?.address,
              selectedAccount?.address,
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

## Environment Variables

By default, wallets will connect to Algorand [MainNet](https://developer.algorand.org/docs/get-details/algorand-networks/mainnet). You can change this behavior by setting the following environment variables:

* `NODE_NETWORK` (defaults to `mainnet`, and can be set to `testnet`, `betanet`, or the name of a local network running in dev mode)
 
* `NODE_SERVER`

* `NODE_TOKEN` 

* `NODE_PORT`

Example `.env` file:

```
NODE_NETWORK=devmodenet
NODE_SERVER=http://algod
NODE_TOKEN=xxxxxxxxx
NODE_PORT=8080
```

### Create React App and Next.js

In Create React App and Next.js projects, you'll need to add a prefix to these environment variables to expose them to the browser.

* `REACT_APP_` in [Create React App](https://create-react-app.dev/docs/adding-custom-environment-variables/)

* `NEXT_PUBLIC_` in [Next.js](https://nextjs.org/docs/basic-features/environment-variables#exposing-environment-variables-to-the-browser)

Example `.env` file in Create React App:

```
REACT_APP_NODE_NETWORK=devmodenet
REACT_APP_NODE_SERVER=http://algod
REACT_APP_NODE_TOKEN=xxxxxxxxx
REACT_APP_NODE_PORT=8080
```

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
yarn dev

```

To develop against a local version of `use-wallet` in your application, do the following:

### Build the library

```bash
yarn build
```

### Symlink the library

In the root of `use-wallet` directory, run:

```bash
yarn link
```

In the root of your application, run:
```bash
yarn link @txnlab/use-wallet
```

### Symlink React 

In the root of your application, run:
```bash
cd node_modules/react
yarn link
```

In the root of `use-wallet` directory, run:
```bash
yarn link react
```

## License

See the [LICENSE](https://github.com/TxnLab/use-wallet/blob/main/LICENSE.md) file for license rights and limitations (MIT)
