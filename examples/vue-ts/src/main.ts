import { NetworkId, WalletId, WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.use(WalletManagerPlugin, {
  wallets: [
    WalletId.DEFLY,
    WalletId.DEFLY_WEB,
    WalletId.EXODUS,
    WalletId.PERA,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
    },
    {
      id: WalletId.BIATEC,
      options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
    },
    WalletId.KMD,
    WalletId.KIBISIS,
    {
      id: WalletId.LIQUID,
      options: {
        origin: 'https://liquid-auth.onrender.com',
        RTC_config_username: "liquid-auth",
        RTC_config_credential: "sqmcP4MiTKMT4TGEDSk9jgHY"
      }
    },
    {
      id: WalletId.LUTE,
      options: { siteName: 'Example Site' }
    },
    {
      id: WalletId.MAGIC,
      options: { apiKey: 'pk_live_D17FD8D89621B5F3' }
    },
    WalletId.MNEMONIC
  ],
  defaultNetwork: NetworkId.TESTNET
})

app.mount('#app')
