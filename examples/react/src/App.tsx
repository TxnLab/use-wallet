import { WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { defly } from '@txnlab/use-wallet-defly'
import { deflyWeb } from '@txnlab/use-wallet-defly-web'
import { exodus } from '@txnlab/use-wallet-exodus'
import { kibisis } from '@txnlab/use-wallet-kibisis'
import { kmd } from '@txnlab/use-wallet-kmd'
import { lute } from '@txnlab/use-wallet-lute'
import { magic } from '@txnlab/use-wallet-magic'
import { mnemonic } from '@txnlab/use-wallet-mnemonic'
import { pera } from '@txnlab/use-wallet-pera'
import { w3wallet } from '@txnlab/use-wallet-w3wallet'
import { walletConnect } from '@txnlab/use-wallet-walletconnect'
import { web3auth } from '@txnlab/use-wallet-web3auth'
import { WalletList } from './WalletList.tsx'
import { ActiveWallet } from './ActiveWallet.tsx'
import { NetworkSwitch } from './NetworkSwitch.tsx'

const WC_PROJECT_ID = 'fcfde0713d43baa0d23be0773c80a72b'

const wallets = [
  pera(),
  lute(),
  defly(),
  deflyWeb(),
  exodus(),
  walletConnect({ projectId: WC_PROJECT_ID }),
  walletConnect({ projectId: WC_PROJECT_ID, skin: 'biatec' }),
  kibisis(),
  w3wallet(),
  kmd(),
  mnemonic(),
  magic({ apiKey: 'pk_live_D17FD8D89621B5F3' }),
  ...(import.meta.env.VITE_WEB3AUTH_CLIENT_ID
    ? [web3auth({ clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID })]
    : [])
]

const walletManager = new WalletManager({
  wallets,
  defaultNetwork: 'testnet'
})

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">
              use-wallet<span className="text-gray-400 font-normal"> / react</span>
            </h1>
            <NetworkSwitch />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
            <WalletList />
            <ActiveWallet />
          </div>
        </main>
      </div>
    </WalletProvider>
  )
}

export default App
