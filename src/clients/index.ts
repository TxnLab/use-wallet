import { PROVIDER_ID } from "../constants";
import peraWalletClient from "./perawallet";
import myAlgoWalletClient from "./myalgowallet";
import algoSignerClient from "./algosigner";
import deflyClient from "./defly";
import exodusClient from "./exodus";
import kmdClient from "./kmd";
import walletconnectClient from "./walletconnect";

export const clients = {
  [PROVIDER_ID.KMD_WALLET]: kmdClient.init(),
  [PROVIDER_ID.PERA_WALLET]: peraWalletClient.init(),
  [PROVIDER_ID.MYALGO_WALLET]: myAlgoWalletClient.init(),
  [PROVIDER_ID.ALGO_SIGNER]: algoSignerClient.init(),
  [PROVIDER_ID.DEFLY]: deflyClient.init(),
  [PROVIDER_ID.EXODUS]: exodusClient.init(),
  [PROVIDER_ID.WALLET_CONNECT]: walletconnectClient.init(),
};
