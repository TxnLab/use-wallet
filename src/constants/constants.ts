export enum PROVIDER_ID {
  PERA_WALLET = "Pera Wallet",
  MYALGO_WALLET = "MyAlgo Wallet",
  ALGO_SIGNER = "Algo Signer",
  DEFLY = "Defly",
  EXODUS = "Exodus",
  WALLET_CONNECT = "Wallet Connect",
}

export const NODE_SERVER =
  process.env.REACT_APP_NODE_URL ||
  process.env.NEXT_PUBLIC_NODE_URL ||
  "https://mainnet-api.algonode.cloud";

export const NODE_TOKEN =
  process.env.REACT_APP_NODE_TOKEN || process.env.NEXT_PUBLIC_NODE_TOKEN || "";

export const NODE_PORT =
  process.env.REACT_APP_NODE_PORT || process.env.NEXT_PUBLIC_NODE_PORT || "";
