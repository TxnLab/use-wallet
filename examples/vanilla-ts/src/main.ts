import './style.css'
import typescriptLogo from '/typescript.svg'
import viteLogo from '/vite.svg'
import { NetworkId, WalletId, WalletManager, type SupportedWallet } from '@txnlab/use-wallet'
import { ActiveNetwork } from './ActiveNetwork'
import { WalletComponent } from './WalletComponent'

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

const walletManager = new WalletManager({
  wallets,
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
