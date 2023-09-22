import { useState, useEffect } from 'react'
import { initializeProviders, reconnectProviders } from '../utils'
import { useDebugStore } from '../store'
import type algosdk from 'algosdk'
import type { NodeConfig, ProvidersArray, SupportedProviders } from '../types/providers'

interface InitializeProvidersOptions {
  providers: ProvidersArray
  nodeConfig?: NodeConfig
  algosdkStatic?: typeof algosdk
  debug?: boolean
}

export default function useInitializeProviders({
  providers,
  nodeConfig,
  algosdkStatic,
  debug = false
}: InitializeProvidersOptions) {
  // Enable debug mode
  const { setDebug } = useDebugStore()
  useEffect(() => setDebug(debug), [debug, setDebug])

  // Initialize providers
  const [walletProviders, setWalletProviders] = useState<SupportedProviders | null>(null)

  useEffect(() => {
    async function initializeAndConnect() {
      try {
        // Initialize with provided configuration
        const initializedProviders = await initializeProviders(providers, nodeConfig, algosdkStatic)

        setWalletProviders(initializedProviders)

        // Reconnect the session when the user returns to the app
        await reconnectProviders(initializedProviders)
      } catch (error) {
        console.error('Error initializing wallet providers:', error)
      }
    }

    void initializeAndConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return walletProviders
}
