import { NetworkId, WalletId } from '@txnlab/use-wallet-js'
import { WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.use(WalletManagerPlugin, {
  wallets: [
    WalletId.DEFLY,
    WalletId.EXODUS,
    WalletId.PERA,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
    },
    WalletId.KMD,
    WalletId.KIBISIS,
    {
      id: WalletId.LUTE,
      options: { siteName: 'Example Site' }
    }
  ],
  network: NetworkId.TESTNET
})

app.mount('#app')
