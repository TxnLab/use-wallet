'use client'

import type { Wallet } from '@txnlab/use-wallet-react'

export function AccountSwitcher({ wallet }: { wallet: Wallet }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Switch Account
      </label>
      <select
        value={wallet.activeAccount?.address ?? ''}
        onChange={(e) => wallet.setActiveAccount(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {wallet.accounts.map((account) => (
          <option key={account.address} value={account.address}>
            {account.address.slice(0, 12)}...{account.address.slice(-8)}
          </option>
        ))}
      </select>
    </div>
  )
}
