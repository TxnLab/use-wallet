<script setup lang="ts">
import { useWallet } from '@txnlab/use-wallet-vue'

const { activeWallet, activeAccount } = useWallet()
</script>

<template>
  <div
    v-if="!activeWallet || !activeAccount"
    class="flex items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12"
  >
    <p class="text-sm text-gray-400">Connect a wallet to get started</p>
  </div>

  <div v-else class="space-y-6">
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <div class="flex items-center gap-4 mb-6">
        <img
          :src="activeWallet.metadata.icon"
          :alt="activeWallet.metadata.name"
          class="h-12 w-12 rounded-xl"
        />
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{{ activeWallet.metadata.name }}</h2>
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
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Active Account
          </label>
          <div class="mt-1 rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700 break-all">
            {{ activeAccount.address }}
          </div>
        </div>

        <AccountSwitcher v-if="activeWallet.accounts.length > 1" :wallet="activeWallet" />
      </div>
    </div>

    <SendTransaction />
    <Authenticate v-if="activeWallet.canSignData" />
  </div>
</template>
