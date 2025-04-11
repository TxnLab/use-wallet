import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-solid'
import { Connect } from './Connect'
import { NetworkControls } from './NetworkControls'
import solidLogo from './assets/solid.svg'
import viteLogo from '/vite.svg'
import './App.css'

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
