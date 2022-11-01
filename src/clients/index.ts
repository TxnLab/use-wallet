import { PROVIDER_ID } from "../constants";
import peraWalletClient from "./perawallet";
import myAlgoWalletClient from "./myalgowallet";
import algoSignerClient from "./algosigner";
import deflyClient from "./defly";
import exodusClient from "./exodus";
import kmdClient from "./kmd";
import walletconnectClient from "./walletconnect";

export const clients = {
  [PROVIDER_ID.KMD_WALLET]: kmdClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.PERA_WALLET]: peraWalletClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.MYALGO_WALLET]: myAlgoWalletClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.ALGO_SIGNER]: algoSignerClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.DEFLY]: deflyClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.EXODUS]: exodusClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
  [PROVIDER_ID.WALLET_CONNECT]: walletconnectClient.init().catch((e) => {
    if (typeof window !== "undefined") {
      console.info("error initializing client", e);
      return;
    }
  }),
};
