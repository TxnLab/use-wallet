<script lang="ts">
  import type { Wallet } from '@txnlab/use-wallet-svelte'
  import { useWallet } from '@txnlab/use-wallet-svelte'

  let { wallet }: { wallet: Wallet } = $props()

  const { activeAccount } = useWallet()
</script>

<div>
  <label for="account-switcher" class="text-xs font-medium text-gray-500 uppercase tracking-wider">
    Switch Account
  </label>
  <select
    id="account-switcher"
    value={activeAccount.current?.address ?? ''}
    onchange={(e) => wallet.setActiveAccount((e.target as HTMLSelectElement).value)}
    class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  >
    {#each wallet.accounts.current ?? [] as account}
      <option value={account.address}>
        {account.address.slice(0, 12)}...{account.address.slice(-8)}
      </option>
    {/each}
  </select>
</div>
