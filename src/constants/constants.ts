import { Network } from "../types";

export enum PROVIDER_ID {
  KMD = "kmd",
  PERA = "pera",
  MYALGO = "myalgo",
  ALGOSIGNER = "algosigner",
  DEFLY = "defly",
  EXODUS = "exodus",
  WALLETCONNECT = "walletconnect",
}

export const DEFAULT_NETWORK: Network = "mainnet";

export const DEFAULT_NODE_BASEURL = "https://mainnet-api.algonode.cloud";

export const DEFAULT_NODE_TOKEN = "";

export const DEFAULT_NODE_PORT = "";
