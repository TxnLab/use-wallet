import type algosdk from 'algosdk'
import allClients from '../clients'
import { PROVIDER_ID, Network, SupportedProviders } from '../types'
import {
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_TOKEN,
  DEFAULT_NODE_PORT,
  DEFAULT_NETWORK
} from '../constants'

type NodeConfig = {
  network: Network
  nodeServer: string
  nodeToken?: string
  nodePort?: string
}

export const initializeProviders = (
  providers?: PROVIDER_ID[],
  nodeConfig?: NodeConfig,
  algosdkStatic?: typeof algosdk
): SupportedProviders => {
  const initializedProviders: SupportedProviders = {}

  if (typeof window === 'undefined') {
    console.warn('Window object is not available, skipping initialization.')
    return initializedProviders
  }

  const {
    network = DEFAULT_NETWORK,
    nodeServer = DEFAULT_NODE_BASEURL,
    nodePort = DEFAULT_NODE_PORT,
    nodeToken = DEFAULT_NODE_TOKEN
  } = nodeConfig || {}

  if (!providers || providers.length === 0)
    for (const [id, client] of Object.entries(allClients)) {
      if (id === 'kmd' || id === 'mnemonic') {
        continue
      }

      initializedProviders[id] = client.init({
        network,
        algodOptions: [nodeToken, nodeServer, nodePort],
        algosdkStatic
      })
    }

  if (providers) {
    for (const id of providers) {
      initializedProviders[id] = allClients[id].init({
        network,
        algodOptions: [nodeToken, nodeServer, nodePort],
        algosdkStatic
      })
    }
  }

  return initializedProviders
}
