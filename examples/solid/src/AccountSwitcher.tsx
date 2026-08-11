import type { Wallet } from '@txnlab/use-wallet-solid'
import { For } from 'solid-js'

export function AccountSwitcher(props: { wallet: Wallet }) {
  return (
    <div>
      <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">
        Switch Account
      </label>
      <select
        value={props.wallet.activeAccount?.address ?? ''}
        onChange={(e) => props.wallet.setActiveAccount(e.currentTarget.value)}
        class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <For each={props.wallet.accounts}>
          {(account) => (
            <option value={account.address}>
              {account.address.slice(0, 12)}...{account.address.slice(-8)}
            </option>
          )}
        </For>
      </select>
    </div>
  )
}
