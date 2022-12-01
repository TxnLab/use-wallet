import React, { useEffect } from "react";
import useWallet from "../../hooks/v1/useWallet";
import WalletProvider from "../../store/state/clientStore";
import Test from "../Test";
import DeflyWalletClient from "../../clients/v1/defly";
import clients, { defly } from "../../clients/v1";

const walletProviders = {
  [defly.metadata.id]: defly.init(),
};

// const reconnectProviders = (
//   providers: Promise<DeflyWalletClient | undefined>[]
// ) => {
//   providers.forEach((client) =>
//     client.then((c) => c?.reconnect(() => console.log("reconnected")))
//   );
// };

export default function ConnectWallet() {
  // useEffect(() => {
  //   reconnectProviders(walletProviders);
  // }, []);

  return (
    <WalletProvider value={walletProviders}>
      <Test />
    </WalletProvider>
  );
}
