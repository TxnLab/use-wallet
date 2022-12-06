import React from "react";
import { useWallet } from "../../index";

export default function ConnectWallet() {
  const {
    providers,
    connectedAccounts,
    connectedActiveAccounts,
    activeAccount,
  } = useWallet();

  // Use these properties to display connected accounts to users.
  React.useEffect(() => {
    console.log("connected accounts", connectedAccounts);
    console.log("connected and active accounts", connectedActiveAccounts);
    console.log("active account", activeAccount);
  });

  // Map through the providers.
  // Render account information and "connect", "set active", and "disconnect" buttons.
  // Finally, map through the `accounts` property to render a dropdown for each connected account.
  return (
    <div>
      {providers?.map((provider) => {
        return (
          <div key={"provider-" + provider.metadata.id}>
            <h4>
              <img width={30} height={30} src={provider.metadata.icon} />
              {provider.metadata.name} {provider.isActive && "[active]"}{" "}
            </h4>
            <div>
              <button
                onClick={provider.connect}
                disabled={provider.isConnected}
              >
                Connect
              </button>
              <button
                onClick={provider.disconnect}
                disabled={!provider.isConnected}
              >
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
        );
      })}
    </div>
  );
}
