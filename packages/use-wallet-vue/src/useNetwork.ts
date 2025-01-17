import { useStore } from '@tanstack/vue-store'
import { WalletManager } from '@txnlab/use-wallet'
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

  const setActiveNetwork = async (networkId: string): Promise<void> => {
    if (networkId === activeNetwork.value) {
      return
    }

    if (!manager.networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Vue] Creating Algodv2 client for ${networkId}...`)

    const { algod } = manager.networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)
    setAlgodClient(newClient)

    manager.store.setState((state) => ({
      ...state,
      activeNetwork: networkId
    }))

    console.info(`[Vue] ✅ Active network set to ${networkId}.`)
  }

  return {
    activeNetwork,
    networks: manager.networks,
    algodClient: computed(() => {
      if (!algodClient.value) {
        throw new Error('Algod client is undefined')
      }
      return algodClient.value
    }),
    setActiveNetwork
  }
}
