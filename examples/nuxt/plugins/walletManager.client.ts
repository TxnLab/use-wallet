import { NetworkId, WalletId, WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(WalletManagerPlugin, {
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
      WalletId.LIQUID,
      {
        id: WalletId.LUTE,
        options: { siteName: 'Example Site' }
      },
      {
        id: WalletId.MAGIC,
        options: { apiKey: 'pk_live_D17FD8D89621B5F3' }
      }
    ],
    network: NetworkId.TESTNET
  })
})
