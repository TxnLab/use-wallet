import { createApp } from 'vue'
import { WalletManagerPlugin } from '../walletManagerPlugin'
import { WalletId, WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet-js'

describe('WalletManagerPlugin', () => {
  it('installs correctly', () => {
    const app = createApp({})
    const mockConfig: WalletManagerConfig = {
      wallets: [WalletId.DEFLY, WalletId.PERA]
    }
    app.use(WalletManagerPlugin, mockConfig)

    const manager = app._context.provides.walletManager
    expect(manager).toBeInstanceOf(WalletManager)
  })
})
