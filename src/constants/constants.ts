export enum PROVIDER_ID {
  KMD_WALLET = "KMD Wallet",
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

export const KMD_HOST =
  process.env.KMD_HOST ||
  process.env.REACT_APP_KMD_HOST ||
  process.env.NEXT_PUBLIC_KMD_HOST ||
  "http://localhost";

export const KMD_TOKEN =
  process.env.KMD_TOKEN ||
  process.env.REACT_APP_KMD_TOKEN ||
  process.env.NEXT_PUBLIC_KMD_TOKEN ||
  "a".repeat(64);

export const KMD_PORT =
  process.env.KMD_PORT ||
  process.env.REACT_APP_KMD_PORT ||
  process.env.NEXT_PUBLIC_KMD_PORT ||
  "4002";

export const KMD_WALLET =
  process.env.KMD_WALLET ||
  process.env.REACT_APP_KMD_WALLET ||
  process.env.NEXT_PUBLIC_KMD_WALLET ||
  "unencrypted-default-wallet";

export const KMD_PASSWORD =
  process.env.KMD_PASSWORD ||
  process.env.REACT_APP_KMD_PASSWORD ||
  process.env.NEXT_PUBLIC_KMD_PASSWORD ||
  "";
