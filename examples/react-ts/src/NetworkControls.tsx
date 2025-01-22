import { AlgodConfig, NetworkId, useNetwork } from '@txnlab/use-wallet-react'
import * as React from 'react'

export function NetworkControls() {
  const {
    activeNetwork,
    networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  } = useNetwork()

  const [error, setError] = React.useState<string>('')
  const [showConfig, setShowConfig] = React.useState(false)

  const [configForm, setConfigForm] = React.useState<Partial<AlgodConfig>>({
    baseServer: activeNetworkConfig.algod.baseServer,
    port: activeNetworkConfig.algod.port?.toString() || '',
    token: activeNetworkConfig.algod.token?.toString() || ''
  })

  React.useEffect(() => {
    setConfigForm({
      baseServer: activeNetworkConfig.algod.baseServer,
      port: activeNetworkConfig.algod.port?.toString() || '',
      token: activeNetworkConfig.algod.token?.toString() || ''
    })
  }, [activeNetworkConfig])

  const handleNetworkSwitch = async (networkId: NetworkId) => {
    try {
      setError('')
      await setActiveNetwork(networkId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to switch networks')
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setConfigForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleConfigSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setError('')
      updateAlgodConfig(activeNetwork, {
        baseServer: configForm.baseServer,
        port: configForm.port || undefined,
        token: configForm.token
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update node configuration')
    }
  }

  const handleResetConfig = () => {
    try {
      setError('')
      resetNetworkConfig(activeNetwork)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset node configuration')
    }
  }

  return (
    <div className="network-group">
      <h4>Network Controls</h4>
      <div className="active-network">Active: {activeNetwork}</div>

      <div className="network-buttons">
        {Object.keys(networkConfig).map((networkId) => (
          <button
            key={networkId}
            onClick={() => handleNetworkSwitch(networkId as NetworkId)}
            disabled={networkId === activeNetwork}
          >
            Switch to {networkId}
          </button>
        ))}
      </div>

      <div className="config-section">
        <button onClick={() => setShowConfig(!showConfig)}>
          {showConfig ? 'Hide' : 'Show'} Network Config
        </button>

        {showConfig && (
          <form onSubmit={handleConfigSubmit} className="config-form">
            <div className="form-group">
              <label htmlFor="baseServer">Base Server:</label>
              <input
                type="text"
                id="baseServer"
                name="baseServer"
                value={configForm.baseServer}
                onChange={handleInputChange}
                placeholder="https://mainnet-api.4160.nodely.dev"
              />
            </div>

            <div className="form-group">
              <label htmlFor="port">Port:</label>
              <input
                type="text"
                id="port"
                name="port"
                value={configForm.port}
                onChange={handleInputChange}
                placeholder="443"
              />
            </div>

            <div className="form-group">
              <label htmlFor="token">Token:</label>
              <input
                type="text"
                id="token"
                name="token"
                value={configForm.token?.toString() || ''}
                onChange={handleInputChange}
                placeholder="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
              />
            </div>

            <button type="submit">Update Configuration</button>
            <button type="button" onClick={handleResetConfig}>
              Reset Configuration
            </button>
          </form>
        )}

        <div className="current-config">
          <h5>Current Algod Configuration:</h5>
          <pre>{JSON.stringify(activeNetworkConfig.algod, null, 2)}</pre>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
