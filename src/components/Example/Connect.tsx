import React, { useState } from 'react'
import { PROVIDER_ID, useWallet } from '../../index'

export default function ConnectWallet() {
  const { providers, connectedAccounts, connectedActiveAccounts, activeAccount } = useWallet()
  const [email, setEmail] = useState('')

  // Use these properties to display connected accounts to users.
  React.useEffect(() => {
    console.log('connected accounts', connectedAccounts)
    console.log('connected and active accounts', connectedActiveAccounts)
    console.log('active account', activeAccount)
  })

  // Map through the providers.
  // Render account information and "connect", "set active", and "disconnect" buttons.
  // Finally, map through the `accounts` property to render a dropdown for each connected account.
  return (
    <div>
      {providers?.map((provider) => {
        return (
          <div key={'provider-' + provider.metadata.id}>
            <h4>
              <img width={30} height={30} src={provider.metadata.icon} />
              {provider.metadata.name} {provider.isActive && '[active]'}{' '}
            </h4>
            <div>
              {provider.metadata.id === PROVIDER_ID.MAGIC && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                />
              )}
              <button
                onClick={() => {
                  provider.connect(provider.metadata.id === PROVIDER_ID.MAGIC ? email : undefined)
                }}
                disabled={provider.isConnected}
              >
                Connect
              </button>
              <button onClick={provider.disconnect} disabled={!provider.isConnected}>
                Disconnect
              </button>
              <button
                onClick={provider.setActiveProvider}
                disabled={!provider.isConnected || provider.isActive}
              >
                Set Active
              </button>
              <div>
                {provider.isActive && provider.accounts.length ? (
                  <select
                    value={activeAccount?.address}
                    onChange={(e) => provider.setActiveAccount(e.target.value)}
                  >
                    {provider.accounts.map((account) => (
                      <option key={account.address} value={account.address}>
                        {account.address}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
