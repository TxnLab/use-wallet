import React, { useEffect } from "react";
import {
  reconnectProviders,
  initializeProviders,
  PROVIDER_ID,
} from "../../hooks/useWallet";
import WalletProvider from "../../store/state/clientStore";
import { pera, myAlgo, defly, exodus } from "../../clients";
import Account from "./Account";
import Connect from "./Connect";
import Transact from "./Transact";

const walletProviders = initializeProviders();

// const walletProviders = {
//   [pera.metadata.id]: pera.init({}),
//   [defly.metadata.id]: defly.init({}),
//   [myAlgo.metadata.id]: myAlgo.init({}),
//   [exodus.metadata.id]: exodus.init({}),
// };

export default function ConnectWallet() {
  useEffect(() => {
    reconnectProviders(walletProviders);
  }, []);

  return (
    <WalletProvider value={walletProviders}>
      <Account />
      <hr />
      <Connect />
      <hr />
      <Transact />
    </WalletProvider>
  );
}
