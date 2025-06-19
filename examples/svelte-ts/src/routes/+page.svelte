<script lang="ts">
  import Connect from '$lib/components/connect.svelte'
  import Network from '$lib/components/network.svelte'
  import { useWallet } from '@txnlab/use-wallet-svelte'
  const { wallets } = useWallet()
</script>

<div id="app">
  <a href="https://vitejs.dev" target="_blank">
    <img src="/vite.svg" class="logo" alt="Vite logo" />
  </a>
  <a href="https://svelte.dev/" target="_blank">
    <img src="./svelte.svg" class="logo svelte" alt="Svelte logo" />
  </a>
  <h1>@txnlab/use-wallet-svelte</h1>
  <Network />
  {#each wallets as wallet}
    <Connect {wallet} />
  {/each}
</div>

<style>
  .logo.svelte:hover {
    filter: drop-shadow(0 0 2em #ff3e00);
  }
</style>
