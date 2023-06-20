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
  PROVIDER_ID
} from '../constants'

export const initializeProviders = async <T extends keyof ProviderConfigMapping>(
  providers?: Array<T | ProviderConfig<T>>,
  nodeConfig?: NodeConfig,
  algosdkStatic?: typeof algosdk
): Promise<SupportedProviders> => {
  const initializedProviders: SupportedProviders = {}

  if (typeof window === 'undefined') {
    // @todo add `debug: Boolean` option to enable/disable console logs
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

  // Initialize default providers if `providers` is undefined or empty
  if (!providers || providers.length === 0) {
    const initPromises = Object.keys(allClients)
      .filter(
        (id) =>
          id !== PROVIDER_ID.KMD && id !== PROVIDER_ID.MNEMONIC && id !== PROVIDER_ID.WALLETCONNECT
      )
      .map((id) => initClient(id as T))

    await Promise.all(initPromises)
  } else {
    const initPromises = providers.map((provider) => initClient(provider))
    await Promise.all(initPromises)
  }

  return initializedProviders
}
