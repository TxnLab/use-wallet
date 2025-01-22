import { AlgodConfig, NetworkId, useNetwork } from '@txnlab/use-wallet-solid'
import { createSignal, createEffect } from 'solid-js'

export function NetworkControls() {
  const {
    activeNetwork,
    networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()

  const [error, setError] = createSignal('')
  const [showConfig, setShowConfig] = createSignal(false)
  const [configForm, setConfigForm] = createSignal<Partial<AlgodConfig>>({
    baseServer: activeNetworkConfig().algod.baseServer,
    port: activeNetworkConfig().algod.port?.toString() || '',
    token: activeNetworkConfig().algod.token?.toString() || ''
  })

  // Update form when network config changes
  createEffect(() => {
    setConfigForm({
      baseServer: activeNetworkConfig().algod.baseServer,
      port: activeNetworkConfig().algod.port?.toString() || '',
      token: activeNetworkConfig().algod.token?.toString() || ''
    })
  })

  const handleNetworkSwitch = async (networkId: NetworkId) => {
    try {
      setError('')
      await setActiveNetwork(networkId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to switch networks')
    }
  }

  const handleInputChange = (event: InputEvent & { currentTarget: HTMLInputElement }) => {
    const { name, value } = event.currentTarget
    setConfigForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleConfigSubmit = async (event: Event) => {
    event.preventDefault()
    try {
      setError('')
      const form = configForm()
      updateAlgodConfig(activeNetwork(), {
        baseServer: form.baseServer,
        port: form.port || undefined,
        token: form.token
      })
    } catch (error) {
      console.error('[NetworkControls] Error updating config:', error)
      setError(error instanceof Error ? error.message : 'Failed to update node configuration')
    }
  }

  const handleResetConfig = () => {
    try {
      setError('')
      resetNetworkConfig(activeNetwork())
    } catch (error) {
      console.error('[NetworkControls] Error resetting config:', error)
      setError(error instanceof Error ? error.message : 'Failed to reset node configuration')
    }
  }

  return (
    <div class="network-group">
      <h4>Network Controls</h4>
      <div class="active-network">Active: {activeNetwork()}</div>

      <div class="network-buttons">
        {Object.keys(networkConfig()).map((networkId) => (
          <button
            onClick={() => handleNetworkSwitch(networkId as NetworkId)}
            disabled={networkId === activeNetwork()}
          >
            Switch to {networkId}
          </button>
        ))}
      </div>

      <div class="config-section">
        <button onClick={() => setShowConfig(!showConfig())}>
          {showConfig() ? 'Hide' : 'Show'} Network Config
        </button>

        {showConfig() && (
          <form onSubmit={handleConfigSubmit} class="config-form">
            <div class="form-group">
              <label for="baseServer">Base Server:</label>
              <input
                type="text"
                id="baseServer"
                name="baseServer"
                value={configForm().baseServer}
                onInput={handleInputChange}
                placeholder="https://mainnet-api.4160.nodely.dev"
              />
            </div>

            <div class="form-group">
              <label for="port">Port:</label>
              <input
                type="text"
                id="port"
                name="port"
                value={configForm().port}
                onInput={handleInputChange}
                placeholder="443"
              />
            </div>

            <div class="form-group">
              <label for="token">Token:</label>
              <input
                type="text"
                id="token"
                name="token"
                value={configForm().token?.toString() || ''}
                onInput={handleInputChange}
                placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
              />
            </div>

            <button type="submit">Update Configuration</button>
            <button type="button" onClick={handleResetConfig}>
              Reset Configuration
            </button>
          </form>
        )}

        <div class="current-config">
          <h5>Current Algod Configuration:</h5>
          <pre>{JSON.stringify(activeNetworkConfig().algod, null, 2)}</pre>
        </div>
      </div>

      {error() && <div class="error-message">{error()}</div>}
    </div>
  )
}
