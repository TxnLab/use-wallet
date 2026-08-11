'use client'

import { WalletList } from '@/components/WalletList'
import { ActiveWallet } from '@/components/ActiveWallet'
import { NetworkSwitch } from '@/components/NetworkSwitch'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            use-wallet<span className="text-gray-400 font-normal"> / next</span>
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
  )
}
