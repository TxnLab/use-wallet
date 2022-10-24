import { PROVIDER_ID } from "../constants";
import { PERA_WALLET } from "./perawallet";
import { MYALGO_WALLET } from "./myalgowallet";
import { ALGO_SIGNER } from "./algosigner";
import { DEFLY } from "./defly";
import { EXODUS } from "./exodus";
import { KMD_WALLET } from "./kmd";
import { WALLET_CONNECT } from "./walletconnect";

export const providers = {
  [PROVIDER_ID.PERA_WALLET]: PERA_WALLET,
  [PROVIDER_ID.MYALGO_WALLET]: MYALGO_WALLET,
  [PROVIDER_ID.DEFLY]: DEFLY,
  [PROVIDER_ID.ALGO_SIGNER]: ALGO_SIGNER,
  [PROVIDER_ID.EXODUS]: EXODUS,
  [PROVIDER_ID.KMD_WALLET]: KMD_WALLET,
  [PROVIDER_ID.WALLET_CONNECT]: WALLET_CONNECT,
};
