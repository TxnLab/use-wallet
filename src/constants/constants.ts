export enum PROVIDER_ID {
  PERA_WALLET = "Pera Wallet",
  MYALGO_WALLET = "MyAlgo Wallet",
  ALGO_SIGNER = "Algo Signer",
  DEFLY = "Defly",
  EXODUS = "Exodus",
  WALLET_CONNECT = "Wallet Connect",
}

export const NODE_SERVER =
  process.env.NODE_SERVER ||
  process.env.REACT_APP_NODE_SERVER ||
  process.env.NEXT_PUBLIC_NODE_SERVER ||
  /** @todo deprecate this env var */
  process.env.NEXT_PUBLIC_NODE_URL ||
  "https://mainnet-api.algonode.cloud";

export const NODE_TOKEN =
  process.env.NODE_TOKEN ||
  process.env.REACT_APP_NODE_TOKEN ||
  process.env.NEXT_PUBLIC_NODE_TOKEN ||
  "";

export const NODE_PORT =
  process.env.NODE_PORT ||
  process.env.REACT_APP_NODE_PORT ||
  process.env.NEXT_PUBLIC_NODE_PORT ||
  "";

export const NODE_NETWORK =
  process.env.NODE_NETWORK ||
  process.env.REACT_APP_NODE_NETWORK ||
  process.env.NEXT_PUBLIC_NODE_NETWORK ||
  /** @todo deprecate this env var */
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  "mainnet";
