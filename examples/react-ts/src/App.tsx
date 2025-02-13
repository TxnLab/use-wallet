import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { Connect } from './Connect'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

const walletManager = new WalletManager({
  wallets: [
    WalletId.DEFLY,
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
    },
    WalletId.MNEMONIC
  ],
  network: NetworkId.TESTNET
})

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>@txnlab/use-wallet-react</h1>
      <Connect />
    </WalletProvider>
  )
}

export default App
