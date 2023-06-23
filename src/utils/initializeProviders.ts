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
  DEFAULT_NETWORK,
  DEFAULT_PROVIDERS
} from '../constants'
import { debugLog, getProviderList } from './debugLog'

export const initializeProviders = async <T extends keyof ProviderConfigMapping>(
  providers?: Array<T | ProviderConfig<T>>,
  nodeConfig?: NodeConfig,
  algosdkStatic?: typeof algosdk
): Promise<SupportedProviders> => {
  const initializedProviders: SupportedProviders = {}

  if (typeof window === 'undefined') {
    debugLog('Window object is not available, skipping initialization')
    return initializedProviders
  }

  const {
    network = DEFAULT_NETWORK,
    nodeServer = DEFAULT_NODE_BASEURL,
    nodePort = DEFAULT_NODE_PORT,
    nodeToken = DEFAULT_NODE_TOKEN
  } = nodeConfig || {}

  const initClient = async (provider: T | ProviderConfig<T>): Promise<void> => {
    const { id, ...providerConfig } = typeof provider === 'string' ? { id: provider } : provider

    const initParams: CommonInitParams = {
      network,
      algodOptions: [nodeToken, nodeServer, nodePort],
      algosdkStatic,
      ...providerConfig
    }

    const client = await allClients[id].init(initParams)
    initializedProviders[id] = client
  }

  if (!providers || providers.length === 0) {
    debugLog('Initializing default providers:', getProviderList(DEFAULT_PROVIDERS))

    const initPromises = Object.keys(allClients)
      .filter((id) => DEFAULT_PROVIDERS.includes(id as T))
      .map((id) => initClient(id as T))

    await Promise.all(initPromises)
  } else {
    debugLog('Initializing custom providers:', getProviderList(providers))

    const initPromises = providers.map((provider) => initClient(provider))
    await Promise.all(initPromises)
  }

  return initializedProviders
}
