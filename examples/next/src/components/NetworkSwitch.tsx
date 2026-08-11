'use client'

import { useNetwork } from '@txnlab/use-wallet-react'

export function NetworkSwitch() {
  const { activeNetwork, networkConfig, setActiveNetwork } = useNetwork()

  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {Object.keys(networkConfig).map((networkId) => (
        <button
          key={networkId}
          onClick={() => setActiveNetwork(networkId)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            networkId === activeNetwork
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {networkId}
        </button>
      ))}
    </div>
  )
}
