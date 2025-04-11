import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet'
import { ActiveNetwork } from './ActiveNetwork'
import { WalletComponent } from './WalletComponent'

const walletManager = new WalletManager({
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

const appDiv = document.querySelector<HTMLDivElement>('#app')

appDiv!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>@txnlab/use-wallet</h1>
  </div>
`

const activeNetwork = new ActiveNetwork(walletManager)
appDiv?.appendChild(activeNetwork.element)

const walletComponents = walletManager.wallets.map(
  (wallet) => new WalletComponent(wallet, walletManager)
)

walletComponents.forEach((walletComponent) => {
  appDiv?.appendChild(walletComponent.element)
})

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await walletManager.resumeSessions()
  } catch (error) {
    console.error('[App] Error resuming sessions:', error)
  }
})

// Cleanup
window.addEventListener('beforeunload', () => {
  walletComponents.forEach((walletComponent) => walletComponent.destroy())
})
