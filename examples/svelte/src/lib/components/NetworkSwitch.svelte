<script lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-svelte'

  const { activeNetwork, networkConfig, setActiveNetwork } = useNetwork()
</script>

<div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
  {#each Object.keys(networkConfig) as networkId}
    <button
      onclick={() => setActiveNetwork(networkId)}
      class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {networkId ===
      activeNetwork.current
        ? 'bg-white text-gray-900 shadow-sm'
        : 'text-gray-500 hover:text-gray-700'}"
    >
      {networkId}
    </button>
  {/each}
</div>
