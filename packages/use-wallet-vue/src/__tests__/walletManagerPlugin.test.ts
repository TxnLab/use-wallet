import { createApp } from 'vue'
import { WalletManagerPlugin } from '../walletManagerPlugin'
import { WalletId, WalletManager, type WalletManagerConfig } from '@txnlab/use-wallet'

describe('WalletManagerPlugin', () => {
  it('installs correctly', () => {
    const app = createApp({})
    const mockConfig: WalletManagerConfig = {
      wallets: [WalletId.DEFLY, WalletId.KIBISIS]
    }
    app.use(WalletManagerPlugin, mockConfig)

    const manager = app._context.provides.walletManager
    expect(manager).toBeInstanceOf(WalletManager)
  })
})
