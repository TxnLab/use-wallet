import type algosdk from "algosdk";
import { PROVIDER_ID, WalletClient, Network } from "../types";
import allClients from "../clients";
import {
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_TOKEN,
  DEFAULT_NODE_PORT,
  DEFAULT_NETWORK,
} from "../constants";

type SupportedProviders = { [x: string]: Promise<WalletClient | null> };

type NodeConfig = {
  network: Network;
  nodeServer: string;
  nodeToken?: string;
  nodePort?: string;
};

export const initializeProviders = (
  providers?: PROVIDER_ID[],
  nodeConfig?: NodeConfig,
  algosdkStatic?: typeof algosdk
) => {
  const initializedProviders: SupportedProviders = {};

  const {
    network = DEFAULT_NETWORK,
    nodeServer = DEFAULT_NODE_BASEURL,
    nodePort = DEFAULT_NODE_PORT,
    nodeToken = DEFAULT_NODE_TOKEN,
  } = nodeConfig || {};

  if (!providers || providers.length === 0)
    for (const [id, client] of Object.entries(allClients)) {
      if (id === "kmd") {
        continue;
      }

      initializedProviders[id] = client.init({
        network,
        algodOptions: [nodeToken, nodeServer, nodePort],
        algosdkStatic: algosdkStatic,
      });
    }

  if (providers) {
    for (const id of providers) {
      initializedProviders[id] = allClients[id].init({
        network,
        algodOptions: [nodeToken, nodeServer, nodePort],
        algosdkStatic: algosdkStatic,
      });
    }
  }

  return initializedProviders;
};
