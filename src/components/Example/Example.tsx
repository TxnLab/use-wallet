import React, { useEffect } from "react";
import {
  reconnectProviders,
  initializeProviders,
  WalletProvider,
} from "../../index";
import Account from "./Account";
import Connect from "./Connect";
import Transact from "./Transact";

const walletProviders = initializeProviders();

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
