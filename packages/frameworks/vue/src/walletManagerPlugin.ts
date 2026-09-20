import { WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet'
import { ref } from 'vue'
import type algosdk from 'algosdk'

export const WalletManagerPlugin = {
  // Accepts either a config (the manager is constructed internally) or an
  // existing instance, e.g. one created with `WalletManager.create()` whose
  // type can back the app's `Register` declaration
  install(app: any, options: WalletManagerConfig | WalletManager<any>) {
    const manager = options instanceof WalletManager ? options : new WalletManager(options)
    const algodClient = ref(manager.algodClient)

    const setAlgodClient = (client: algosdk.Algodv2) => {
      algodClient.value = client
      manager.algodClient = client
    }

    app.provide('walletManager', manager)
    app.provide('algodClient', algodClient)
    app.provide('setAlgodClient', setAlgodClient)

    manager.resumeSessions().catch((error) => {
      console.error('Error resuming sessions:', error)
    })
  }
}
