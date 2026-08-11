<script setup lang="ts">
import { useNetwork } from '@txnlab/use-wallet-vue'

const { activeNetwork, networkConfig, setActiveNetwork } = useNetwork()
</script>

<template>
  <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
    <button
      v-for="networkId in Object.keys(networkConfig)"
      :key="networkId"
      @click="setActiveNetwork(networkId)"
      :class="[
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        networkId === activeNetwork
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      ]"
    >
      {{ networkId }}
    </button>
  </div>
</template>
