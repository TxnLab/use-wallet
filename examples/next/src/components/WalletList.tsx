'use client'

import { useWallet, type Wallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'

export function WalletList() {
  const { availableWallets, isReady } = useWallet()
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = async (wallet: Wallet) => {
    try {
      setConnecting(wallet.id)
      await wallet.connect()
    } catch (error) {
      console.error(`Failed to connect ${wallet.metadata.name}:`, error)
    } finally {
      setConnecting(null)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Wallets</h2>
      {availableWallets.map((wallet) => (
        <WalletRow
          key={wallet.walletKey}
          wallet={wallet}
          isReady={isReady}
          isConnecting={connecting === wallet.id}
          onConnect={() => handleConnect(wallet)}
        />
      ))}
    </div>
  )
}

function WalletRow({
  wallet,
  isReady,
  isConnecting,
  onConnect
}: {
  wallet: Wallet
  isReady: boolean
  isConnecting: boolean
  onConnect: () => void
}) {
  const isConnected = isReady && wallet.isConnected
  const isActive = isReady && wallet.isActive

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isActive ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <img
          src={wallet.metadata.icon}
          alt={wallet.metadata.name}
          className="h-10 w-10 rounded-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">{wallet.metadata.name}</div>
          {isConnected && wallet.activeAccount && (
            <div className="text-xs text-gray-400 truncate font-mono">
              {wallet.activeAccount.address.slice(0, 8)}...
              {wallet.activeAccount.address.slice(-4)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isConnected ? (
            <>
              {!isActive && (
                <button
                  onClick={() => wallet.setActive()}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  Activate
                </button>
              )}
              <button
                onClick={() => wallet.disconnect()}
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
