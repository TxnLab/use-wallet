import {
  NetworkId,
  WalletId,
  WalletManagerPlugin,
  type SupportedWallet
} from '@txnlab/use-wallet-vue'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

const app = createApp(App)

const wallets: SupportedWallet[] = [
  WalletId.DEFLY,
  WalletId.DEFLY_WEB,
  WalletId.EXODUS,
  WalletId.PERA,
  {
    id: WalletId.WALLETCONNECT,
    options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
  },
  {
    id: WalletId.WALLETCONNECT,
    options: {
      skin: 'biatec',
      projectId: 'fcfde0713d43baa0d23be0773c80a72b'
    }
  },
  WalletId.KMD,
  WalletId.KIBISIS,
  WalletId.LUTE,
  {
    id: WalletId.MAGIC,
    options: { apiKey: 'pk_live_D17FD8D89621B5F3' }
  },
  WalletId.MNEMONIC,
  WalletId.W3_WALLET
]

// Add Web3Auth if client ID is configured
if (import.meta.env.VITE_WEB3AUTH_CLIENT_ID) {
  wallets.push({
    id: WalletId.WEB3AUTH,
    options: {
      clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID,
      ...(import.meta.env.VITE_WEB3AUTH_VERIFIER && {
        verifier: import.meta.env.VITE_WEB3AUTH_VERIFIER
      })
    }
  })
}

app.use(WalletManagerPlugin, {
  wallets,
  defaultNetwork: NetworkId.TESTNET
})

app.mount('#app')
