import { WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet'

export const WalletManagerPlugin = {
  install(app: any, options: WalletManagerConfig) {
    const manager = new WalletManager(options)
    app.provide('walletManager', manager)

    manager.resumeSessions().catch((error) => {
      console.error('Error resuming sessions:', error)
    })
  }
}
