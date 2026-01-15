import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
  type SupportedWallet
} from '@txnlab/use-wallet-solid'
import { Connect } from './Connect'
import { NetworkControls } from './NetworkControls'
import solidLogo from '/solid.svg'
import viteLogo from '/vite.svg'
import './App.css'

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

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} class="logo" alt="Vite logo" />
        </a>
        <a href="https://solidjs.com" target="_blank">
          <img src={solidLogo} class="logo solid" alt="Solid logo" />
        </a>
      </div>
      <h1>@txnlab/use-wallet-solid</h1>
      <NetworkControls />
      <Connect />
    </WalletProvider>
  )
}

export default App
