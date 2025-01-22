import { useStore } from '@tanstack/vue-store'
import { WalletManager, type AlgodConfig } from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import { computed, inject, ref } from 'vue'
import type { SetAlgodClient } from './useWallet'

export function useNetwork() {
  const manager = inject<WalletManager>('walletManager')
  const algodClient = inject<ReturnType<typeof ref<algosdk.Algodv2>>>('algodClient')
  const setAlgodClient = inject<SetAlgodClient>('setAlgodClient')

  if (!manager) {
    throw new Error('WalletManager plugin is not properly installed')
  }
  if (!algodClient || !setAlgodClient) {
    throw new Error('Algod client or setter not properly installed')
  }

  const activeNetwork = useStore(manager.store, (state) => state.activeNetwork)

  // Create a reactive store for network config
  const networkConfig = useStore(manager.store, (state) => ({
    networks: { ...manager.networkConfig },
    activeNetwork: state.activeNetwork
  }))

  const activeNetworkConfig = computed(
    () => networkConfig.value.networks[networkConfig.value.activeNetwork]
  )

  const setActiveNetwork = async (networkId: string): Promise<void> => {
    if (networkId === activeNetwork.value) {
      return
    }

    if (!manager.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Vue] Creating new Algodv2 client...`)

    const { algod } = manager.networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

    await manager.setActiveNetwork(networkId)
    setAlgodClient(newClient)

    console.info(`[Vue] ✅ Active network set to ${networkId}.`)
  }

  const updateAlgodConfig = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager.updateAlgodConfig(networkId, config)
    manager.store.setState((state) => ({ ...state }))

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork.value) {
      console.info(`[Vue] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
      setAlgodClient(newClient)
    }
  }

  const resetNetworkConfig = (networkId: string): void => {
    manager.resetNetworkConfig(networkId)
    manager.store.setState((state) => ({ ...state }))

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork.value) {
      console.info(`[Vue] Creating new Algodv2 client...`)
      const { algod } = manager.networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
      setAlgodClient(newClient)
    }
  }

  return {
    activeNetwork,
    networkConfig: manager.networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  }
}
