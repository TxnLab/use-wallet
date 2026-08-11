<script setup lang="ts">
import { ref } from 'vue'
import { useWallet, type Wallet } from '@txnlab/use-wallet-vue'

const { availableWallets } = useWallet()
const connecting = ref<string | null>(null)

const handleConnect = async (wallet: Wallet) => {
  try {
    connecting.value = wallet.id
    await wallet.connect()
  } catch (error) {
    console.error(`Failed to connect ${wallet.metadata.name}:`, error)
  } finally {
    connecting.value = null
  }
}
</script>

<template>
  <div class="space-y-2">
    <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Wallets</h2>
    <div
      v-for="wallet in availableWallets"
      :key="wallet.walletKey"
      :class="[
        'rounded-xl border p-3 transition-colors',
        wallet.isActive
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      ]"
    >
      <div class="flex items-center gap-3">
        <img
          :src="wallet.metadata.icon"
          :alt="wallet.metadata.name"
          class="h-10 w-10 rounded-lg shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900">{{ wallet.metadata.name }}</div>
          <div
            v-if="wallet.isConnected && wallet.activeAccount"
            class="text-xs text-gray-400 truncate font-mono"
          >
            {{ wallet.activeAccount.address.slice(0, 8) }}...{{
              wallet.activeAccount.address.slice(-4)
            }}
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <template v-if="wallet.isConnected">
            <button
              v-if="!wallet.isActive"
              @click="wallet.setActive()"
              class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
            >
              Activate
            </button>
            <button
              @click="wallet.disconnect()"
              class="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-100 transition-colors"
            >
              Disconnect
            </button>
          </template>
          <button
            v-else
            @click="handleConnect(wallet)"
            :disabled="connecting === wallet.id"
            class="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {{ connecting === wallet.id ? 'Connecting...' : 'Connect' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
