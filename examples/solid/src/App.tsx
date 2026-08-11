import { WalletList } from './WalletList.tsx'
import { ActiveWallet } from './ActiveWallet.tsx'
import { NetworkSwitch } from './NetworkSwitch.tsx'

function App() {
  return (
    <div class="min-h-screen bg-gray-50">
      <header class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 class="text-lg font-semibold tracking-tight text-gray-900">
            use-wallet<span class="text-gray-400 font-normal"> / solid</span>
          </h1>
          <NetworkSwitch />
        </div>
      </header>
      <main class="mx-auto max-w-5xl px-6 py-8">
        <div class="grid gap-8 lg:grid-cols-[320px_1fr]">
          <WalletList />
          <ActiveWallet />
        </div>
      </main>
    </div>
  )
}

export default App
