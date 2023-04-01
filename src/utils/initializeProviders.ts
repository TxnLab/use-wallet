import type algosdk from 'algosdk'
import allClients from '../clients'
import {
  CommonInitParams,
  NodeConfig,
  ProviderConfig,
  ProviderConfigMapping,
  SupportedProviders
} from '../types'
import {
  DEFAULT_NODE_BASEURL,
  DEFAULT_NODE_TOKEN,
  DEFAULT_NODE_PORT,
  DEFAULT_NETWORK
} from '../constants'

export const initializeProviders = async <T extends keyof ProviderConfigMapping>(
  providers?: Array<T | ProviderConfig<T>>,
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

  const initClient = async (provider: T | ProviderConfig<T>): Promise<void> => {
    const id = typeof provider === 'string' ? provider : provider.id
    const config = typeof provider === 'object' ? provider.config : undefined

    const initParams: CommonInitParams = {
      network,
      algodOptions: [nodeToken, nodeServer, nodePort],
      algosdkStatic,
      ...(config || {})
    }

    initializedProviders[id] = Promise.resolve(await allClients[id].init(initParams))
  }

  if (!providers || providers.length === 0) {
    const initPromises = Object.entries(allClients)
      .filter(([id]) => id !== 'kmd' && id !== 'mnemonic')
      .map(([id]) => initClient(id as T))

    await Promise.all(initPromises)
  } else {
    const initPromises = providers.map((provider) => initClient(provider))
    await Promise.all(initPromises)
  }

  return initializedProviders
}
