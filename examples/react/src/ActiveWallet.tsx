import { useWallet } from '@txnlab/use-wallet-react'
import { AccountSwitcher } from './AccountSwitcher.tsx'
import { Authenticate } from './Authenticate.tsx'
import { SendTransaction } from './SendTransaction.tsx'

export function ActiveWallet() {
  const { activeWallet, activeAccount } = useWallet()

  if (!activeWallet || !activeAccount) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12">
        <p className="text-sm text-gray-400">Connect a wallet to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={activeWallet.metadata.icon}
            alt={activeWallet.metadata.name}
            className="h-12 w-12 rounded-xl"
          />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{activeWallet.metadata.name}</h2>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Connected
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Active Account
            </label>
            <div className="mt-1 rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700 break-all">
              {activeAccount.address}
            </div>
          </div>

          {activeWallet.accounts.length > 1 && <AccountSwitcher wallet={activeWallet} />}
        </div>
      </div>

      <SendTransaction />
      {activeWallet.canSignData && <Authenticate />}
    </div>
  )
}
