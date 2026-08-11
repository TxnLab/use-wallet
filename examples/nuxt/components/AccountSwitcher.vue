<script setup lang="ts">
import type { Wallet } from '@txnlab/use-wallet-vue'

const props = defineProps<{ wallet: Wallet }>()
</script>

<template>
  <div>
    <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">
      Switch Account
    </label>
    <select
      :value="props.wallet.activeAccount?.address ?? ''"
      @change="props.wallet.setActiveAccount(($event.target as HTMLSelectElement).value)"
      class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option
        v-for="account in props.wallet.accounts"
        :key="account.address"
        :value="account.address"
      >
        {{ account.address.slice(0, 12) }}...{{ account.address.slice(-8) }}
      </option>
    </select>
  </div>
</template>
