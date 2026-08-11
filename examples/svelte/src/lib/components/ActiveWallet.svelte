<script lang="ts">
  import { useWallet } from '@txnlab/use-wallet-svelte'
  import AccountSwitcher from './AccountSwitcher.svelte'
  import Authenticate from './Authenticate.svelte'
  import SendTransaction from './SendTransaction.svelte'

  const { activeWallet, activeAccount } = useWallet()
</script>

{#if !activeWallet() || !activeAccount.current}
  <div
    class="flex items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12"
  >
    <p class="text-sm text-gray-400">Connect a wallet to get started</p>
  </div>
{:else}
  {@const wallet = activeWallet()!}
  {@const account = activeAccount.current!}
  <div class="space-y-6">
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <div class="flex items-center gap-4 mb-6">
        <img
          src={wallet.metadata.icon}
          alt={wallet.metadata.name}
          class="h-12 w-12 rounded-xl"
        />
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{wallet.metadata.name}</h2>
          <div class="flex items-center gap-1.5">
            <span
              class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
            >
              Connected
            </span>
            <span
              class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              Active
            </span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Active Account
          </span>
          <div class="mt-1 rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700 break-all">
            {account.address}
          </div>
        </div>

        {#if (wallet.accounts.current?.length ?? 0) > 1}
          <AccountSwitcher {wallet} />
        {/if}
      </div>
    </div>

    <SendTransaction />
    {#if wallet.canSignData}
      <Authenticate />
    {/if}
  </div>
{/if}
