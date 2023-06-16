import { useState, useEffect } from 'react'
import { initializeProviders, reconnectProviders } from '../utils'
import type algosdk from 'algosdk'
import type {
  NodeConfig,
  ProviderConfig,
  ProviderConfigMapping,
  SupportedProviders
} from '../types'

interface InitializeProvidersOptions<
  T extends keyof ProviderConfigMapping = keyof ProviderConfigMapping
> {
  providers?: Array<T | ProviderConfig<T>>
  nodeConfig?: NodeConfig
  algosdkStatic?: typeof algosdk
}

export default function useInitializeProviders<
  T extends keyof ProviderConfigMapping = keyof ProviderConfigMapping
>({ providers, nodeConfig, algosdkStatic }: InitializeProvidersOptions<T> = {}) {
  const [walletProviders, setWalletProviders] = useState<SupportedProviders | null>(null)

  useEffect(() => {
    let active = true
    async function initializeAndConnect() {
      try {
        // Initialize with provided or default configuration
        const initializedProviders = await initializeProviders(providers, nodeConfig, algosdkStatic)

        // Bail out if the dependencies changed while initializing
        if (!active) return

        setWalletProviders(initializedProviders)

        // Reconnect the session when the user returns to the app
        await reconnectProviders(initializedProviders)
      } catch (error) {
        console.error('Error initializing wallet providers:', error)
      }
    }

    void initializeAndConnect()

    return () => {
      active = false
    }
  }, [algosdkStatic, nodeConfig, providers])

  return walletProviders
}
