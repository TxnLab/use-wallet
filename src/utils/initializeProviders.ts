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

export const initializeProviders = async (
  providers?: PROVIDER_ID[],
  nodeConfig?: NodeConfig,
  algosdkStatic?: typeof algosdk
): Promise<SupportedProviders> => {
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

  const initClient = async (id: string): Promise<void> => {
    initializedProviders[id] = Promise.resolve(
      await allClients[id].init({
        network,
        algodOptions: [nodeToken, nodeServer, nodePort],
        algosdkStatic
      })
    )
  }

  if (!providers || providers.length === 0) {
    const initPromises = Object.entries(allClients)
      .filter(([id]) => id !== 'kmd' && id !== 'mnemonic')
      .map(([id]) => initClient(id))

    await Promise.all(initPromises)
  } else {
    const initPromises = providers.map((id) => initClient(id))
    await Promise.all(initPromises)
  }

  return initializedProviders
}
