<script lang="ts">
  import { NetworkId, useNetwork } from '@txnlab/use-wallet-svelte'
  const { activeNetwork, setActiveNetwork } = useNetwork()
</script>

<div class="network-group">
  <h4>
    Current Network: <span class="active-network">{activeNetwork.current}</span>
  </h4>
  <div class="network-buttons">
    {#each Object.values(NetworkId) as network}
      <button
        onclick={() => setActiveNetwork(network)}
        disabled={network === activeNetwork.current}
      >
        Switch to {network}
      </button>
    {/each}
  </div>
</div>
