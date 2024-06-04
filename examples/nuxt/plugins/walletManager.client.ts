import { NetworkId, WalletId, WalletManagerPlugin } from '@txnlab/use-wallet-vue'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(WalletManagerPlugin, {
    wallets: [
      WalletId.DEFLY,
      WalletId.EXODUS,
      {
        id: WalletId.PERA,
        options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' }
      },
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
})
