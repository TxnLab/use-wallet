import React, { useEffect } from "react";
import {
  reconnectProviders,
  initializeProviders,
  PROVIDER_ID,
} from "../../hooks/v1/useWallet";
import WalletProvider from "../../store/state/clientStore";
import { defly, myAlgo, algoSigner, exodus, pera } from "../../clients/v1";
import Connect from "./Connect";

/**
 * @todo
 * Pass in object to init functions
 * Change PROVIDER_ID constants to lowercase
 */

const walletProviders = {
  [defly.metadata.id]: defly.init(),
  [myAlgo.metadata.id]: myAlgo.init(),
  [algoSigner.metadata.id]: algoSigner.init(),
  [exodus.metadata.id]: exodus.init(),
  [pera.metadata.id]: pera.init(),
};

export default function ConnectWallet() {
  useEffect(() => {
    reconnectProviders(walletProviders);
  }, []);

  return (
    <WalletProvider value={walletProviders}>
      <Connect />
    </WalletProvider>
  );
}
