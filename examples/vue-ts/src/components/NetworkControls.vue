<script setup lang="ts">
import { AlgodConfig, NetworkId, useNetwork } from '@txnlab/use-wallet-vue'
import { ref, reactive, watch } from 'vue'

const {
  activeNetwork,
  networkConfig,
  activeNetworkConfig,
  setActiveNetwork,
  updateAlgodConfig,
  resetNetworkConfig
} = useNetwork()

const error = ref('')
const showConfig = ref(false)

const configForm = reactive<Partial<AlgodConfig>>({
  baseServer: activeNetworkConfig.value.algod.baseServer,
  port: activeNetworkConfig.value.algod.port?.toString() || '',
  token: activeNetworkConfig.value.algod.token?.toString() || ''
})

watch(
  () => activeNetworkConfig.value,
  (newConfig) => {
    configForm.baseServer = newConfig.algod.baseServer
    configForm.port = newConfig.algod.port?.toString() || ''
    configForm.token = newConfig.algod.token?.toString() || ''
  }
)

const handleNetworkSwitch = async (networkId: NetworkId) => {
  try {
    error.value = ''
    await setActiveNetwork(networkId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to switch networks'
  }
}

const handleConfigSubmit = async (event: Event) => {
  event.preventDefault()
  try {
    error.value = ''
    updateAlgodConfig(activeNetwork.value, {
      baseServer: configForm.baseServer,
      port: configForm.port || undefined,
      token: configForm.token
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update node configuration'
  }
}

const handleResetConfig = () => {
  try {
    error.value = ''
    resetNetworkConfig(activeNetwork.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to reset node configuration'
  }
}
</script>

<template>
  <div class="network-group">
    <h4>Network Controls</h4>
    <div class="active-network">Active: {{ activeNetwork }}</div>

    <div class="network-buttons">
      <button
        v-for="networkId in Object.keys(networkConfig)"
        :key="networkId"
        @click="() => handleNetworkSwitch(networkId as NetworkId)"
        :disabled="networkId === activeNetwork"
      >
        Switch to {{ networkId }}
      </button>
    </div>

    <div class="config-section">
      <button @click="showConfig = !showConfig">
        {{ showConfig ? 'Hide' : 'Show' }} Network Config
      </button>

      <form v-if="showConfig" @submit="handleConfigSubmit" class="config-form">
        <div class="form-group">
          <label for="baseServer">Base Server:</label>
          <input
            type="text"
            id="baseServer"
            v-model="configForm.baseServer"
            placeholder="https://mainnet-api.4160.nodely.dev"
          />
        </div>

        <div class="form-group">
          <label for="port">Port:</label>
          <input type="text" id="port" v-model="configForm.port" placeholder="443" />
        </div>

        <div class="form-group">
          <label for="token">Token:</label>
          <input
            type="text"
            id="token"
            v-model="configForm.token"
            placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          />
        </div>

        <button type="submit">Update Configuration</button>
        <button type="button" @click="handleResetConfig">Reset Configuration</button>
      </form>

      <div class="current-config">
        <h5>Current Algod Configuration:</h5>
        <pre>{{ JSON.stringify(activeNetworkConfig.algod, null, 2) }}</pre>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<style scoped>
.network-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  margin: 2em;
  padding: 2em;
  background-color: light-dark(rgba(0, 0, 0, 0.025), rgba(255, 255, 255, 0.025));
  border-color: light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.1));
  border-style: solid;
  border-width: 1px;
  border-radius: 8px;
}

.network-group h4 {
  margin: 0;
}

.active-network {
  text-transform: capitalize;
}

.network-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5em;
}
</style>
