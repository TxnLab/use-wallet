import { PROVIDER_ID } from "../constants";
import peraWalletClient from "./perawallet";
import myAlgoWalletClient from "./myalgowallet";
import algoSignerClient from "./algosigner";
import deflyClient from "./defly";
import exodusClient from "./exodus";
import walletconnectClient from "./walletconnect";

export const clients = {
  [PROVIDER_ID.PERA_WALLET]: peraWalletClient,
  [PROVIDER_ID.MYALGO_WALLET]: myAlgoWalletClient,
  [PROVIDER_ID.ALGO_SIGNER]: algoSignerClient,
  [PROVIDER_ID.DEFLY]: deflyClient,
  [PROVIDER_ID.EXODUS]: exodusClient,
  [PROVIDER_ID.WALLET_CONNECT]: walletconnectClient,
};
