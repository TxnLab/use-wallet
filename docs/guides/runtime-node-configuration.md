---
layout:
  title:
    visible: true
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
---

# Runtime Node Configuration

Starting with v4.0.0, use-wallet provides methods to update Algod node configurations at runtime. This feature gives users the freedom to connect to their preferred nodes while maintaining your application's default configuration as a fallback option.

Common use cases include:

* Users running their own private Algod nodes
* Teams working with custom network configurations
* Connecting to fallback nodes (like Nodely's [backup endpoints](https://nodely.io/docs/free/backup/)) when the primary node is unavailable

### Basic Usage

The `useNetwork` hook/composable provides two methods for managing node configurations:

* `updateAlgodConfig` - Update a network's node configuration
* `resetNetworkConfig` - Reset a network's configuration to defaults

{% tabs %}
{% tab title="React" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-react'

function NodeConfig() {
  const { updateAlgodConfig, resetNetworkConfig } = useNetwork()

  const handleNodeChange = () => {
    // Update node configuration for MainNet
    updateAlgodConfig('mainnet', {
      baseServer: 'https://secondary-node.com',
      port: '443',
      token: ''
    })
  }

  const handleReset = () => {
    // Reset MainNet back to default configuration
    resetNetworkConfig('mainnet')
  }

  return (
    <div>
      <button onClick={handleNodeChange}>
        Use Secondary Node
      </button>
      <button onClick={handleReset}>
        Reset Node
      </button>
    </div>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-vue'

  const { updateAlgodConfig, resetNetworkConfig } = useNetwork()

  const handleNodeChange = () => {
    // Update node configuration for TestNet
    updateAlgodConfig('testnet', {
      baseServer: 'https://testnet-api.algonode.cloud',
      port: '443',
      token: ''
    })
  }

  const handleReset = () => {
    // Reset TestNet back to default configuration
    resetNetworkConfig('testnet')
  }
</script>

<template>
  <div>
    <button @click="handleNodeChange">
      Use AlgoNode
    </button>
    <button @click="handleReset">
      Reset Node
    </button>
  </div>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { useNetwork } from '@txnlab/use-wallet-solid'

function NodeConfig() {
  const { updateAlgodConfig, resetNetworkConfig } = useNetwork()

  const handleNodeChange = () => {
    // Update node configuration for TestNet
    updateAlgodConfig('testnet', {
      baseServer: 'https://testnet-api.algonode.cloud',
      port: '443',
      token: ''
    })
  }

  const handleReset = () => {
    // Reset TestNet back to default configuration
    resetNetworkConfig('testnet')
  }

  return (
    <div>
      <button onClick={handleNodeChange}>
        Use AlgoNode
      </button>
      <button onClick={handleReset}>
        Reset Node
      </button>
    </div>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-svelte'

  const { updateAlgodConfig, resetNetworkConfig } = useNetwork()

  const handleNodeChange = () => {
    // Update node configuration for TestNet
    updateAlgodConfig('testnet', {
      baseServer: 'https://testnet-api.algonode.cloud',
      port: '443',
      token: ''
    })
  }

  const handleReset = () => {
    // Reset TestNet back to default configuration
    resetNetworkConfig('testnet')
  }
</script>

<div>
  <button onclick={handleNodeChange}>
    Use AlgoNode
  </button>
  <button @click={handleReset}>
    Reset Node
  </button>
</div>
```
{% endtab %}
{% endtabs %}

### Configuration Persistence

Node configurations are automatically saved to local storage. This means:

* Custom configurations persist across page reloads
* Each network's configuration can be customized independently
* Resetting a network only affects that specific network's configuration

### Configuration Options

When updating node configurations, you can provide any of these settings:

```typescript
interface AlgodConfig {
  // API token or authentication header
  token: string | algosdk.AlgodTokenHeader | algosdk.CustomTokenHeader

  // Base URL of the node
  baseServer: string

  // Port number (optional)
  port?: string | number

  // Custom headers (optional)
  headers?: Record<string, string>
}
```

### Automatic Updates

When updating the configuration for the active network, use-wallet automatically:

1. Creates a new Algod client with the updated configuration
2. Updates all components that depend on the Algod client
3. Saves the configuration to local storage

No additional steps are needed to start using the new node.

### Example Form

Here's a complete example showing how to implement a node configuration form:

{% tabs %}
{% tab title="React" %}
```tsx
import { useState } from 'react'
import { useNetwork } from '@txnlab/use-wallet-react'

function NodeConfigForm() {
  const {
    activeNetwork,
    activeNetworkConfig,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()
  
  const [formData, setFormData] = useState({
    baseServer: activeNetworkConfig.algod.baseServer,
    port: activeNetworkConfig.algod.port || '',
    token: ''
  })
  const [error, setError] = useState('')

  const handleSubmit = async ((e): React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await updateAlgodConfig(activeNetwork, {
        baseServer: formData.baseServer,
        port: formData.port || undefined,
        token: formData.token || ''
      })
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Configure {activeNetwork} Node</h3>
      
      <div>
        <label>Server URL:</label>
        <input
          type="url"
          value={formData.baseServer}
          onChange={(e) => setFormData((d) => ({ ...d, baseServer: e.target.value }))}
          required
        />
      </div>

      <div>
        <label>Port:</label>
        <input
          type="text"
          value={formData.port}
          onChange={(e) => setFormData((d) => ({ ...d, port: e.target.value }))}
          placeholder="Optional"
        />
      </div>

      <div>
        <label>Token:</label>
        <input
          type="password"
          value={formData.token}
          onChange={(e) => setFormData((d) => ({ ...d, token: e.target.value }))}
          placeholder="Optional"
        />
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div>
        <button type="submit">
          Update Node
        </button>
        <button type="button" onClick={() => resetNetworkConfig(activeNetwork)}>
          Reset to Default
        </button>
      </div>
    </form>
  )
}
```
{% endtab %}

{% tab title="Vue" %}
```vue
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useNetwork } from '@txnlab/use-wallet-vue'

  const {
    activeNetwork,
    activeNetworkConfig,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()

  const formData = ref({
    baseServer: activeNetworkConfig.value.algod.baseServer,
    port: activeNetworkConfig.value.algod.port || '',
    token: ''
  })

  const error = ref('')

  const handleSubmit = async ((e): Event) => {
    e.preventDefault()
    error.value = ''

    try {
      await updateAlgodConfig(activeNetwork.value, {
        baseServer: formData.value.baseServer,
        port: formData.value.port || undefined,
        token: formData.value.token || ''
      })
    } catch (err: any) {
      error.value = err.message
    }
  }
</script>

<template>
  <form @submit="handleSubmit">
    <h3>Configure {{ activeNetwork }} Node</h3>
    
    <div>
      <label>Server URL:</label>
      <input
        type="url"
        v-model="formData.baseServer"
        required
      />
    </div>

    <div>
      <label>Port:</label>
      <input
        type="text"
        v-model="formData.port"
        placeholder="Optional"
      />
    </div>

    <div>
      <label>Token:</label>
      <input
        type="password"
        v-model="formData.token"
        placeholder="Optional"
      />
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div>
      <button type="submit">
        Update Node
      </button>
      <button type="button" @click="() => resetNetworkConfig(activeNetwork)">
        Reset to Default
      </button>
    </div>
  </form>
</template>
```
{% endtab %}

{% tab title="Solid" %}
```tsx
import { createSignal } from 'solid-js'
import { useNetwork } from '@txnlab/use-wallet-solid'

function NodeConfigForm() {
  const {
    activeNetwork,
    activeNetworkConfig,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()
  
  const [formData, setFormData] = createSignal({
    baseServer: activeNetworkConfig().algod.baseServer,
    port: activeNetworkConfig().algod.port || '',
    token: ''
  })
  
  const [error, setError] = createSignal('')

  const handleSubmit = async ((e): Event) => {
    e.preventDefault()
    setError('')

    try {
      await updateAlgodConfig(activeNetwork(), {
        baseServer: formData().baseServer,
        port: formData().port || undefined,
        token: formData().token || ''
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Configure {activeNetwork()} Node</h3>
      
      <div>
        <label>Server URL:</label>
        <input
          type="url"
          value={formData().baseServer}
          onChange={(e) => setFormData((d) => ({ ...d, baseServer: e.currentTarget.value }))}
          required
        />
      </div>

      <div>
        <label>Port:</label>
        <input
          type="text"
          value={formData().port}
          onChange={(e) => setFormData((d) => ({ ...d, port: e.currentTarget.value }))}
          placeholder="Optional"
        />
      </div>

      <div>
        <label>Token:</label>
        <input
          type="password"
          value={formData().token}
          onChange={(e) => setFormData((d) => ({ ...d, token: e.currentTarget.value }))}
          placeholder="Optional"
        />
      </div>

      {error() && (
        <div class="error">
          {error()}
        </div>
      )}

      <div>
        <button type="submit">
          Update Node
        </button>
        <button type="button" onClick={() => resetNetworkConfig(activeNetwork())}>
          Reset to Default
        </button>
      </div>
    </form>
  )
}
```
{% endtab %}

{% tab title="Svelte" %}
```sv
<script lang="ts">
  import { useNetwork } from '@txnlab/use-wallet-svelte'

  const {
    activeNetwork,
    activeNetworkConfig,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()

  const formData = $state({
    baseServer: activeNetworkConfig().algod.baseServer,
    port: activeNetworkConfig().algod.port || '',
    token: ''
  })

  const error = $state('')

  const handleSubmit = async ((e): Event) => {
    e.preventDefault()
    error = ''

    try {
      await updateAlgodConfig(activeNetwork(), {
        baseServer: formData.baseServer,
        port: formData.port || undefined,
        token: formData.token || ''
      })
    } catch (err: any) {
      error = err.message
    }
  }
</script>

<form @submit="handleSubmit">
  <h3>Configure {activeNetwork()} Node</h3>
  
  <div>
    <label>Server URL:</label>
    <input
      type="url"
      bind:value={formData.baseServer}
      required
    />
  </div>

  <div>
    <label>Port:</label>
    <input
      type="text"
      bind:value={formData.port}
      placeholder="Optional"
    />
  </div>

  <div>
    <label>Token:</label>
    <input
      type="password"
      bind:value={formData.token}
      placeholder="Optional"
    />
  </div>

  {#if error}
    <div class="error">
      {{ error }}
    </div>
  {/if}

  <div>
    <button type="submit">
      Update Node
    </button>
    <button type="button" onclick={() => resetNetworkConfig(activeNetwork())}>
      Reset to Default
    </button>
  </div>
</form>
```
{% endtab %}
{% endtabs %}

