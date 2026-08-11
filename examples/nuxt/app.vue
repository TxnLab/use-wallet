<script setup lang="ts">
import WalletList from '~/components/WalletList.vue'
import ActiveWallet from '~/components/ActiveWallet.vue'
import NetworkSwitch from '~/components/NetworkSwitch.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white">
      <div class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <h1 class="text-lg font-semibold tracking-tight text-gray-900">
          use-wallet<span class="text-gray-400 font-normal"> / nuxt</span>
        </h1>
        <NetworkSwitch />
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-6 py-8">
      <div class="grid gap-8 lg:grid-cols-[320px_1fr]">
        <WalletList />
        <ActiveWallet />
      </div>
    </main>
  </div>
</template>
